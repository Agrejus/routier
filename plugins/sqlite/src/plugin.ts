import { canPushDownJoin, decodeJsonColumns, splitJoinRows } from '@routier/sql-plugin-core';
import { assertIsNotNull, OptimisticConcurrencyError, UnknownRecord } from '@routier/core';
import { buildFromPersistOperation, buildFromQueryOperation, buildJoinQueryOperation, compiledSchemaToSqliteTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { ResultColumn } from '@routier/core/plugins';
import { SqlPersistOperation } from './types';
import type { SqliteConnection, SqliteDriver } from './drivers/types';

export type SqliteDbPluginOptions = {
    /**
     * The engine to run against.
     *
     * Defaults to `node:sqlite` in Node and SQLite WASM over OPFS in a browser, chosen by the
     * `exports` conditions in this package's manifest. Pass one explicitly to override:
     * `sqlite3Driver()` for Node 18 and 20, or `wasmDriver({ storage: 'memory' })` for a
     * browser database that should not persist.
     */
    driver?: SqliteDriver;
};

/**
 * SQLite reports a missing table only in the message; there is no code to match on.
 *
 * Reads `message` structurally rather than testing `instanceof Error`. An error raised by a
 * native module is constructed in Node's realm, and Jest runs each test file in its own VM
 * context with its own `Error`, so `instanceof` is false for exactly the errors this needs to
 * classify. That turned every lazy table creation into a hard failure under test while working
 * in production, which is the worst version of this bug to have.
 */
const isMissingTable = (error: unknown) => {
    const message = (error as { message?: unknown } | null)?.message;

    return typeof message === 'string' && message.includes('no such table');
};

/**
 * The engine-independent half of the plugin.
 *
 * Every statement it runs is built by `utils.ts` and `@routier/sql-plugin-core`, neither of
 * which knows what a connection is. The concrete `SqliteDbPlugin` each environment exports
 * differs only in which driver it defaults to.
 */
export class SqliteDbPluginBase implements IDbPlugin {

    /**
     * See `IDbPlugin.databaseName`. This is the file path as the caller spelled it, which is
     * as far as a plugin that also runs in the browser can go: resolving it needs a file
     * system. Two spellings of one file — a relative and an absolute path — therefore read as
     * two databases and will not share subscription channels. Pass a consistent path.
     */
    readonly databaseName: string;
    protected readonly driver: SqliteDriver;

    /**
     * Derived CREATE TABLE statements, keyed by collection name.
     *
     * Per INSTANCE, not per module. A module-global cache keyed by collection name alone
     * conflates databases: two plugins over different files that happen to share a
     * collection name would serve each other's DDL, so the second file could be created
     * with the first schema's columns. The cost of re-deriving per instance is one string
     * build per collection.
     */
    private readonly tableCache = new Map<string, string>();

    /**
     * Serializes writes, because SQLite has ONE write lock per database.
     *
     * A store writes from more than one place — the caller's `saveChanges`, and every view
     * reconciling in response to it — and those calls overlap. Two of them reaching a SQLite
     * file at once means the second gets "database is locked" rather than waiting, and for a
     * view that failure is only logged, leaving it silently stale.
     *
     * It belongs HERE and not in the datastore. Serialization is a fact about this engine, not
     * about writing in general: PostgreSQL, MySQL and MongoDB take concurrent writes and
     * queueing them costs real throughput — measured at roughly four times slower for
     * concurrent saves. Putting the queue in the plugin leaves those untouched, and every
     * caller reaches it because every caller goes through `bulkPersist`.
     *
     * A chained promise rather than a lock: each write starts when the previous one settles,
     * whether it succeeded or failed, so one failure does not stall the rest. Sequential saves
     * pay nothing — the chain is already resolved, so the work starts on the next microtask.
     *
     * Per INSTANCE, which is the same scope the connection is. Two plugins over one file still
     * contend, and no in-process queue can fix that: another process is the same problem. That
     * is what `busy_timeout` is for, and it is a separate question from this one.
     */
    private writes: Promise<unknown> = Promise.resolve();

    constructor(databaseName: string, driver: SqliteDriver) {
        this.databaseName = databaseName;
        this.driver = driver;
    }

    private resolveTableCreateStatement(schema: CompiledSchema<unknown>): string {
        const collectionName = schema.collectionName;
        const cached = this.tableCache.get(collectionName);

        if (cached != null) {
            return cached;
        }

        const createTableSQL = compiledSchemaToSqliteTable(schema);

        this.tableCache.set(collectionName, createTableSQL);

        return createTableSQL;
    }

    /**
     * Runs `work` against one connection and closes it on every path.
     *
     * One connection per operation, closed whether the work succeeds, fails, or throws.
     * Queries used to leak one handle each for the life of the process (#31), and closing in
     * a `finally` is what makes a path added later unable to forget.
     *
     * Deliberately NOT a long-lived shared connection: per-operation connections are what let
     * SQLite's own file locking serialize concurrent writers, and a shared handle would make
     * disposal a lifecycle problem for every caller.
     */
    private async withConnection<T>(work: (connection: SqliteConnection) => Promise<T>): Promise<T> {
        // An open failure must not be reported as anything else, and must not leave a handle
        // behind: there is nothing to close if the open never succeeded (#34).
        const connection = await this.driver.open(this.databaseName);

        try {
            return await work(connection);
        } finally {
            await connection.close().catch((): void => undefined);
        }
    }

    /**
     * Runs a statement, creating the table and retrying once if it does not exist yet.
     *
     * Tables are created lazily on first use rather than up front, so the first read or write
     * against a new collection is expected to miss.
     */
    private async runWithTable(
        connection: SqliteConnection,
        operation: { sql: string; params?: readonly unknown[]; result?: readonly ResultColumn[] },
        createTableSql: string
    ): Promise<unknown[]> {
        const { sql, params, result } = operation;

        try {
            return await connection.all(sql, params, result);
        } catch (error) {
            if (isMissingTable(error) === false) {
                throw error;
            }

            await connection.run(createTableSql);

            // The retry passes the SAME description. Dropping it here would leave the one path
            // that always runs for a new collection — the first read or write against it — on a
            // slower route than every later one, and nothing would report the difference.
            return await connection.all(sql, params, result);
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

        const createTableSQL = this.resolveTableCreateStatement(event.operation.schema);
        const translator = new SqlTranslator(event.operation);
        const operation = buildFromQueryOperation(event.operation);
        const { params, sql } = operation;

        this.withConnection(connection => this.runWithTable(connection, operation, createTableSQL))
            .then(rows => {
                // After the statement ran, not before: RetryDbPlugin re-invokes with the same
                // event, so pushing first would report one entry per failed attempt.
                event.executedQueries.push({ text: sql, parameters: params });

                // Nested objects and arrays are stored as JSON columns (see
                // toColumnAssignments); decode them before translation so the entity gets a
                // structure back rather than a JSON string. Skips properties whose schema
                // does its own deserialization.
                const decoded = decodeJsonColumns(rows as TShape, event.operation.schema);

                done(PluginEventResult.success(event.id, translator.translate(decoded)));
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    /**
     * A join, done by SQLite rather than in memory.
     *
     * The engine pairs the rows; everything else here is about the pairs arriving in the shape the
     * contract promises. `splitJoinRows` cuts each flat row in two and deserializes each half
     * against its own schema, so what the translator receives is already tuples — which is why it
     * is constructed with `{ join: true }` and passes the option through.
     *
     * Both tables are created if missing, not just the outer one: a join against a collection
     * nothing has written yet is a legitimate query returning no pairs, and "no such table" is not
     * the right answer to it.
     */
    private queryJoined<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        try {
            const join = event.operation.options.getLast("join");
            assertIsNotNull(join, "A joined query reached queryJoined without a join option.");

            const innerSchema = event.schemas.get(join.value.innerSchemaId);

            if (innerSchema == null) {
                done(PluginEventResult.error(event.id, new Error(
                    `Cannot join: the inner collection's schema is not registered in this store.  SchemaId: ${join.value.innerSchemaId}`
                )));
                return;
            }

            /**
             * An inner filter core could not push down means there is no column to compare — an
             * unmapped or renamed property. Emitting the join anyway would silently return rows
             * the inner side's scope excludes, so the plugin says it did NOT push down and the
             * translator refuses rather than answering wrongly.
             */
            if (canPushDownJoin(join.value) === false) {
                done(PluginEventResult.error(event.id, new Error(
                    `Cannot push this join down to SQLite: the inner collection has a filter that cannot be expressed as SQL ` +
                    `(an unmapped or renamed property), so the join would return rows its scope excludes.`
                )));
                return;
            }

            const joinOperation = buildJoinQueryOperation(event.operation, innerSchema);
            const { sql, params } = joinOperation;
            const translator = new SqlTranslator(event.operation, { join: true });

            const createTables = [
                this.resolveTableCreateStatement(event.operation.schema),
                this.resolveTableCreateStatement(innerSchema)
            ].join("\n");

            this.withConnection(connection => this.runWithTable(connection, joinOperation, createTables))
                .then(rows => {
                    event.executedQueries.push({ text: sql, parameters: params });

                    const tuples = splitJoinRows({
                        rows: rows as UnknownRecord[],
                        kind: join.value.kind,
                        join: join.value,
                        outerSchema: event.operation.schema,
                        innerSchema
                    });

                    done(PluginEventResult.success(event.id, translator.translate(tuples)));
                })
                .catch(error => done(PluginEventResult.error(event.id, error)));
        } catch (error) {
            done(PluginEventResult.error(event.id, error));
        }
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        const run = () => this.persist(event)
            .then(result => done(PluginEventResult.success(event.id, result)))
            .catch(error => done(PluginEventResult.error(event.id, error)));

        // `then(run, run)`: the next write starts whichever way the previous one went.
        this.writes = this.writes.then(run, run);
    }

    private async persist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        const result = event.operation.toResult();

        // Flattened: one entry per operation, removes before updates before adds within
        // a schema, so a save mixing all three applies all three (grouping them and
        // executing only one per group silently dropped the rest).
        const operations: { op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes' }[] = [];

        for (const [schemaId, changes] of event.operation) {

            if (!changes || changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            const persistOperations = buildFromPersistOperation(schema, changes);
            const createTableSql = compiledSchemaToSqliteTable(schema);

            if (persistOperations.removes != null) {
                operations.push({ op: { ...persistOperations.removes, createTableSql, schemaId }, type: 'removes' });
            }

            // One operation per changed-column group (see buildGroupedUpdateOperations)
            for (const updateOperation of persistOperations.updates) {
                operations.push({ op: { ...updateOperation, createTableSql, schemaId }, type: 'updates' });
            }

            if (persistOperations.adds != null) {
                operations.push({ op: { ...persistOperations.adds, createTableSql, schemaId }, type: 'adds' });
            }
        }

        return this.withConnection(async connection => {
            /**
             * Files RETURNING rows into the result for their schema.
             *
             * Decoding happens here and not only on the query path: `mergeChanges`
             * deserializes what a plugin echoes back, so a JSON column returned as a raw
             * string reaches the entity's deserializer as a string and throws on the
             * first nested property access.
             */
            const collect = (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes', rows: unknown[]) => {
                const decoded = decodeJsonColumns(rows, event.schemas.get(op.schemaId)) as { [x: string]: never; }[];
                const bucket = result.get(op.schemaId);

                if (type === "adds") {
                    bucket.adds.push(...decoded);
                } else if (type === "updates") {
                    bucket.updates.push(...decoded);
                } else {
                    bucket.removes.push(...decoded);
                }
            };

            // BEGIN IMMEDIATE takes the RESERVED lock up front, so it is the statement that
            // fails with SQLITE_BUSY when another writer holds the file. That error used to
            // be discarded — the callback was omitted entirely — and execution fell straight
            // through to the operations below, which then ran with no transaction at all: a
            // mid-batch failure left the earlier writes committed and the ROLLBACK had
            // nothing to undo (#32). Awaiting it means a failure here aborts the save.
            await connection.run('BEGIN IMMEDIATE TRANSACTION');

            try {
                for (const { op, type } of operations) {
                    const rows = await this.runWithTable(connection, op, op.createTableSql);

                    // A token-checked UPDATE that matched no row lost the race: another writer
                    // changed the row after this one read it. Roll everything back and name it.
                    if (op.conflictCheck != null && rows.length === 0) {
                        throw new OptimisticConcurrencyError(
                            event.schemas.get(op.schemaId).collectionName,
                            [op.conflictCheck.id as never]
                        );
                    }

                    collect(op, type, rows);
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

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.driver.deleteDatabase(this.databaseName)
            .then(() => done(PluginEventResult.success(event.id)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }
}
