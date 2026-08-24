import { canPushDownJoin, decodeJsonColumns, splitJoinRows } from '@routier/sql-plugin-core';
import { assertIsNotNull, OptimisticConcurrencyError, PluginDestroyedError, UnknownRecord } from '@routier/core';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { logger } from '@routier/core/utilities';
import {
    buildFromPersistOperation,
    buildFromQueryOperation,
    buildJoinQueryOperation,
    compiledSchemaToPostgresTable,
    NO_VECTOR_SUPPORT,
    PostgresVectorSupport
} from './utils';
import { PostgresSqlTranslator } from './PostgresSqlTranslator';
import { SqlPersistOperation } from './types';
import type { PostgresConnection, PostgresDriver } from './drivers/types';

/**
 * The SQLSTATE codes this plugin recovers from, rather than message text, which is localised.
 *
 * Exported because a driver whose transport drops the code has to put it back — see
 * `@routier/pglite-plugin`, where a worker rebuilds the error from its message alone.
 */
export const RECOVERABLE_SQLSTATE = {
    undefinedTable: '42P01',
    duplicateTable: '42P07',
    uniqueViolation: '23505',
} as const;

const { undefinedTable: UNDEFINED_TABLE, duplicateTable: DUPLICATE_TABLE, uniqueViolation: UNIQUE_VIOLATION } = RECOVERABLE_SQLSTATE;

const errorCode = (error: unknown): string | undefined =>
    (error as { code?: unknown } | null)?.code as string | undefined;

/**
 * Two connections creating one table at once collide in the system catalog even with
 * `IF NOT EXISTS`: `42P07`, or `23505` on `pg_type_typname_nsp_index`. Either way the other
 * connection won and the table now exists.
 */
const lostTableCreationRace = (error: unknown): boolean => {
    const code = errorCode(error);

    return code === DUPLICATE_TABLE || code === UNIQUE_VIOLATION;
};

/**
 * `42704` undefined_object, raised as `type "vector" does not exist` when DDL asks for a vector
 * column in a database where the extension is not installed.
 */
const UNDEFINED_OBJECT = '42704';

const missingVectorType = (error: unknown): boolean =>
    errorCode(error) === UNDEFINED_OBJECT
    && /type "?vector"? does not exist/i.test((error as { message?: unknown })?.message as string ?? '');

type PersistOperation = { op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes' };

/**
 * The engine-independent half of the PostgreSQL plugin.
 *
 * Every statement it runs is built by `utils.ts` and `@routier/sql-plugin-core`, neither of
 * which knows what a connection is. The concrete plugin each engine exports differs only in
 * the `PostgresDriver` it is constructed with — `pg` against a server, PGlite against
 * WebAssembly.
 */
export class PostgresDbPluginBase implements IDbPlugin {

    protected readonly driver: PostgresDriver;

    /** See `IDbPlugin.databaseName`. The driver names its own target; see `PostgresDriver`. */
    readonly databaseName: string;

    /**
     * Set by `destroy`, so work already in flight fails as a destroyed plugin rather than
     * throwing out of a callback.
     *
     * A query is not one synchronous call: it awaits the vector probe, and a view's reconcile
     * awaits its own read before writing. A store destroyed during either gap reaches the
     * driver after it was disposed, and the view that issued the work is not even being
     * watched any more.
     */
    private destroyed = false;

    /**
     * Derived CREATE TABLE statements, keyed by collection name. Per INSTANCE: a module-global
     * cache would let two plugins over different databases serve each other's DDL.
     */
    private readonly tableCache = new Map<string, string>();

    /** Resolved once per plugin instance; see `resolveVectorSupport`. */
    private vectorProbe: Promise<PostgresVectorSupport> | null = null;

    constructor(driver: PostgresDriver) {
        this.driver = driver;
        this.databaseName = driver.databaseName;
    }

    /**
     * Runs `work` against one connection and releases it on every path.
     *
     * The plugin never asks for a second connection while holding one, which is what lets a
     * single-connection driver serialise `connect` without deadlocking.
     */
    private async withConnection<T>(work: (connection: PostgresConnection) => Promise<T>): Promise<T> {
        if (this.destroyed) {
            throw new PluginDestroyedError("the store was destroyed before this operation reached the database");
        }

        const connection = await this.driver.connect();

        try {
            return await work(connection);
        } finally {
            await connection.release().catch((): void => undefined);
        }
    }

    private resolveTableCreateStatement(schema: CompiledSchema<any>, vectors: PostgresVectorSupport): string {
        const collectionName = schema.collectionName;
        const cached = this.tableCache.get(collectionName);

        if (cached != null) {
            return cached;
        }

        const createTableSQL = compiledSchemaToPostgresTable(schema, undefined, vectors);

        this.tableCache.set(collectionName, createTableSQL);

        return createTableSQL;
    }

    /**
     * Whether this database can store and search a `vector` column, asked once and reused.
     *
     * A schema with `s.vector()` works either way — without the extension the numbers go into
     * JSONB and the similarity search runs in memory. So this decides how FAST the feature is,
     * never whether it is available, and a probe that fails for any reason lands on the path
     * that always works.
     *
     * The promise is cached rather than the value, so concurrent first queries share one probe
     * instead of racing to create the extension.
     *
     * **Decided per plugin instance, and the DDL it produces is permanent.** A table created
     * as JSONB keeps that column type after the extension is installed later — SQL plugins
     * here do not migrate.
     */
    private resolveVectorSupport(): Promise<PostgresVectorSupport> {
        if (this.vectorProbe != null) {
            return this.vectorProbe;
        }

        this.vectorProbe = this.withConnection(async connection => {
            const installed = await connection.all(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);

            if (installed.length > 0) {
                return { available: true };
            }

            // Needs privileges an application role often lacks, and in PGlite needs the
            // extension bundle to have been loaded. A failure is ordinary, not exceptional.
            await connection.run('CREATE EXTENSION IF NOT EXISTS vector');

            return { available: true };
        }).catch(() => NO_VECTOR_SUPPORT);

        return this.vectorProbe;
    }

    /**
     * Runs a statement, creating the table and retrying once if it does not exist yet.
     *
     * Tables are created lazily on first use, so the first read against a new collection is
     * expected to miss. No savepoints: this path runs outside a transaction, where PostgreSQL
     * has nothing to abort and `SAVEPOINT` is an error in its own right.
     */
    private async runWithTable(
        connection: PostgresConnection,
        sql: string,
        params: readonly unknown[] | undefined,
        createTableSql: string
    ): Promise<unknown[]> {
        try {
            return await connection.all(sql, params);
        } catch (error) {
            if (errorCode(error) !== UNDEFINED_TABLE) {
                throw error;
            }

            await connection.run(createTableSql).catch(createError => {
                if (lostTableCreationRace(createError) === false) {
                    throw createError;
                }
            });

            return await connection.all(sql, params);
        }
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        if (event.operation.options.has("join")) {
            this.queryJoined(event, done);
            return;
        }

        this.resolveVectorSupport()
            .then(vectors => {
                // Built once, here, and handed down. The builder decides whether the search
                // made it into the SQL, and the translator has to be told the SAME answer —
                // building twice would let the statement and the decision about it drift.
                const built = buildFromQueryOperation(event.operation, vectors);
                const translator = new PostgresSqlTranslator(event.operation, { nearest: built.nearestPushedDown });
                const createTableSql = this.resolveTableCreateStatement(event.operation.schema, vectors);

                logger.debug('[DB] PostgreSQL query:', {
                    sql: built.sql,
                    paramsCount: built.params.length,
                    table: event.operation.schema.collectionName,
                });

                return this.withConnection(connection =>
                    this.runWithTable(connection, built.sql, built.params, createTableSql)
                ).then(rows => {
                    // After the statement ran, not before: RetryDbPlugin re-invokes with the
                    // same event, so pushing first would report one entry per failed attempt.
                    event.executedQueries.push({ text: built.sql, parameters: built.params });

                    // Nested objects and arrays are stored as JSON columns; decode them before
                    // translation so the entity gets a structure back rather than a JSON
                    // string. Skips properties whose schema does its own deserialization.
                    const decoded = decodeJsonColumns(rows, event.operation.schema);

                    done(PluginEventResult.success(event.id, translator.translate(decoded)));
                });
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    /**
     * A join, done by PostgreSQL rather than in memory.
     *
     * The engine pairs the rows; `splitJoinRows` cuts each flat row back into two halves and
     * deserializes each against its own schema, so the translator receives tuples already —
     * which is why it is told `{ join: true }` and passes the option through.
     */
    private queryJoined<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.resolveVectorSupport()
            .then(vectors => {
                const join = event.operation.options.getLast("join");
                assertIsNotNull(join, "A joined query reached queryJoined without a join option.");

                const innerSchema = event.schemas.get(join.value.innerSchemaId);

                if (innerSchema == null) {
                    throw new Error(
                        `Cannot join: the inner collection's schema is not registered in this store.  SchemaId: ${join.value.innerSchemaId}`
                    );
                }

                // An inner filter with no column to compare against would make the emitted join
                // return rows the inner side's scope excludes. Refusing beats answering wrongly.
                if (canPushDownJoin(join.value) === false) {
                    throw new Error(
                        `Cannot push this join down to PostgreSQL: the inner collection has a filter that cannot be expressed as SQL ` +
                        `(an unmapped or renamed property), so the join would return rows its scope excludes.`
                    );
                }

                const built = buildJoinQueryOperation(event.operation, innerSchema, vectors);
                const translator = new PostgresSqlTranslator(event.operation, { join: true });

                // Both tables, not just the outer one: a join against a collection nothing has
                // written yet is a legitimate query with no pairs.
                const createTableSql = [
                    this.resolveTableCreateStatement(event.operation.schema, vectors),
                    this.resolveTableCreateStatement(innerSchema, vectors)
                ].join("\n");

                return this.withConnection(connection =>
                    this.runWithTable(connection, built.sql, built.params, createTableSql)
                ).then(rows => {
                    event.executedQueries.push({ text: built.sql, parameters: built.params });

                    const tuples = splitJoinRows({
                        rows: rows as UnknownRecord[],
                        kind: join.value.kind,
                        join: join.value,
                        outerSchema: event.operation.schema,
                        innerSchema
                    });

                    done(PluginEventResult.success(event.id, translator.translate(tuples)));
                });
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        // The probe gates the write too, not just the read: it decides the column type this
        // table is created with, and a table created before the answer is known would get
        // JSONB on a database that could have given it a real vector column.
        this.resolveVectorSupport()
            .then(vectors => this.persist(event, vectors))
            .then(result => done(PluginEventResult.success(event.id, result)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    private async persist(event: DbPluginBulkPersistEvent, vectors: PostgresVectorSupport): Promise<BulkPersistResult> {
        const result = event.operation.toResult();

        // Flattened: one entry per operation, removes before updates before adds within a
        // schema, so a save mixing all three applies all three (grouping them and executing
        // only one per group silently dropped the rest).
        const operations: PersistOperation[] = [];

        for (const [schemaId, changes] of event.operation) {
            if (!changes || changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            const persistOperations = buildFromPersistOperation(schema, changes);
            const createTableSql = this.resolveTableCreateStatement(schema, vectors);

            if (persistOperations.removes != null) {
                operations.push({ op: { ...persistOperations.removes, createTableSql, schemaId }, type: 'removes' });
            }

            // One operation PER GROUP: PostgreSQL permits exactly one command per
            // parameterized statement, so heterogeneous update batches cannot be joined with
            // ';' — each group runs as its own statement inside the transaction.
            for (const updateOperation of persistOperations.updates) {
                operations.push({ op: { ...updateOperation, createTableSql, schemaId }, type: 'updates' });
            }

            if (persistOperations.adds != null) {
                operations.push({ op: { ...persistOperations.adds, createTableSql, schemaId }, type: 'adds' });
            }
        }

        return this.withConnection(async connection => {
            await connection.run('BEGIN');

            try {
                for (let index = 0; index < operations.length; index++) {
                    const { op, type } = operations[index];

                    logger.debug(`[DB] PostgreSQL ${type} operation:`, {
                        sql: op.sql,
                        paramsCount: (op.params ?? []).length,
                        schemaId: op.schemaId,
                    });

                    const rows = await this.runInTransactionWithTable(connection, op, `sp_${index}_${type}`);

                    // A token-checked UPDATE that matched no row lost the race: another writer
                    // changed the row after this one read it. Roll everything back and name it.
                    if (op.conflictCheck != null && rows.length === 0) {
                        throw new OptimisticConcurrencyError(
                            event.schemas.get(op.schemaId).collectionName,
                            [op.conflictCheck.id as never]
                        );
                    }

                    // Decoding happens here and not only on the query path: `mergeChanges`
                    // deserializes what a plugin echoes back, so a JSON column returned as a
                    // raw string reaches the entity's deserializer as a string and throws on
                    // the first nested property access.
                    const decoded = decodeJsonColumns(rows, event.schemas.get(op.schemaId)) as { [x: string]: never; }[];
                    const bucket = result.get(op.schemaId);

                    if (type === "adds") {
                        bucket.adds.push(...decoded);
                    } else if (type === "updates") {
                        bucket.updates.push(...decoded);
                    } else {
                        bucket.removes.push(...decoded);
                    }
                }

                await connection.run('COMMIT');
            } catch (error) {
                // The rollback must not replace the error that caused it; a failed rollback on
                // an already-aborted transaction would otherwise hide the real cause.
                await connection.run('ROLLBACK').catch((): void => undefined);

                throw error;
            }

            return result;
        });
    }

    /**
     * The write, with lazy table creation, inside a transaction.
     *
     * PostgreSQL aborts the whole transaction on the first error, so the failed write must be
     * rolled back to a savepoint before any recovery can run. Without that, the CREATE TABLE
     * executes inside an aborted transaction and fails with `25P02`.
     */
    private async runInTransactionWithTable(
        connection: PostgresConnection,
        op: SqlPersistOperation,
        savepoint: string
    ): Promise<unknown[]> {
        await connection.run(`SAVEPOINT ${savepoint}`);

        try {
            return await connection.all(op.sql, op.params);
        } catch (error) {
            if (errorCode(error) !== UNDEFINED_TABLE) {
                throw error;
            }

            await connection.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            await this.createTableInTransaction(connection, op.createTableSql, `${savepoint}_ddl`);

            logger.debug('[DB] PostgreSQL retry after table creation:', {
                sql: op.sql,
                paramsCount: (op.params ?? []).length,
            });

            return await connection.all(op.sql, op.params);
        }
    }

    /**
     * The DDL gets its own savepoint: `CREATE TABLE IF NOT EXISTS` is not atomic against a
     * concurrent creator, and a failed create with no savepoint would abort the whole
     * transaction with no way back.
     */
    private async createTableInTransaction(
        connection: PostgresConnection,
        createTableSql: string,
        savepoint: string
    ): Promise<void> {
        await connection.run(`SAVEPOINT ${savepoint}`);

        try {
            await connection.run(createTableSql);
        } catch (error) {
            if (missingVectorType(error)) {
                await connection.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                await this.createTableWithVectorExtension(connection, createTableSql, savepoint);
                return;
            }

            if (lostTableCreationRace(error) === false) {
                throw error;
            }

            await connection.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        }
    }

    /**
     * Installs the extension the DDL needs, then creates the table.
     *
     * The vector probe is answered once per plugin instance and its answer is remembered, but the
     * database it described is not necessarily the one being written to now: an embedded engine
     * that another store destroyed is replaced by an empty one, with no extensions. So a `vector`
     * column can reach a database that has no `vector` type, and the fix is to install it rather
     * than to fail on DDL that was right when it was built.
     */
    private async createTableWithVectorExtension(
        connection: PostgresConnection,
        createTableSql: string,
        savepoint: string
    ): Promise<void> {
        await connection.run(`SAVEPOINT ${savepoint}_vector`);

        try {
            await connection.run('CREATE EXTENSION IF NOT EXISTS vector');
            await connection.run(createTableSql);
        } catch (error) {
            // The extension is genuinely unavailable here, so this schema cannot have a real
            // vector column. Nothing left to try: a JSONB table would contradict the DDL every
            // other statement in this transaction was built against.
            await connection.run(`ROLLBACK TO SAVEPOINT ${savepoint}_vector`).catch((): void => undefined);

            throw error;
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroyed = true;

        this.driver.destroy()
            .then(() => done(PluginEventResult.success(event.id)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }
}
