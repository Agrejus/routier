import { canPushDownJoin, decodeJsonColumns, splitJoinRows } from '@routier/sql-plugin-core';
import { assertIsNotNull, ConcurrencyDbPlugin, UnknownRecord } from '@routier/core';
import { buildFromPersistOperation, buildFromQueryOperation, buildJoinQueryOperation, compiledSchemaToSqliteTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { BulkPersistResult, SchemaCollection } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { SqlPersistOperation } from './types';

/**
 * Cloudflare D1 — SQLite, but reachable only through `batch()`.
 *
 * ## Why this is a plugin and not a driver
 *
 * Every other SQLite engine here is a `SqliteDriver`: `sql-plugin-core` builds the statements
 * and the driver only moves them. D1 cannot be one, and the reason is not the transport.
 *
 * `SqliteDriver` exposes `run` and `all` against an open connection, and the plugin uses that
 * shape to hold a transaction open — BEGIN IMMEDIATE, a statement, a look at what came back,
 * then the next statement. D1 has no interactive transaction at all. Its only atomicity
 * primitive is `batch()`, which takes every statement UP FRONT and either applies all of them
 * or none. There is no point at which statement N's result can decide whether N+1 runs, so the
 * interface a driver would have to implement is not one D1 can offer.
 *
 * What makes this cheap anyway: the SQLite plugin already builds its whole `operations` list
 * before it opens a connection. The statements were always batch-shaped; only the execution
 * was not. So this variant shares `utils.ts` — the same DDL, the same WHERE generation, the
 * same grouped updates — and differs solely in how it hands them over.
 *
 * ## What it gives up
 *
 * Optimistic concurrency, and it says so rather than pretending. See `assertNoConcurrency`.
 *
 * ## Usage
 *
 * The binding comes from the Workers environment, so it is passed in rather than opened —
 * there is nothing here to connect to and no credentials to hold:
 *
 * ```ts
 * export default {
 *     async fetch(request: Request, env: Env) {
 *         const store = new MyStore(new D1DbPlugin(env.DB));
 *         // ...
 *     },
 * };
 * ```
 */

/**
 * A bound, ready-to-run statement.
 *
 * Typed structurally, like the libSQL client the Turso driver takes, so
 * `@cloudflare/workers-types` is not a dependency of this package and a caller's real binding
 * satisfies it without a cast.
 */
export interface D1PreparedStatement {
    /** Binds positional parameters. Returns a new statement; D1's is not mutating. */
    bind(...values: unknown[]): D1PreparedStatement;
    /** Runs the statement and returns its rows, including a `RETURNING` clause's. */
    all<T = unknown>(): Promise<{ results: T[] }>;
}

/** The subset of Cloudflare's `D1Database` this plugin uses. */
export interface D1Database {
    prepare(sql: string): D1PreparedStatement;
    /**
     * Runs every statement as ONE transaction: all of them apply, or none does.
     *
     * A failure rejects and rolls the whole sequence back, which is the property this plugin
     * depends on for a multi-statement save.
     */
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]>;
}

export type D1DbPluginOptions = {
    /**
     * How to drop the database, if dropping it is something the caller wants to allow.
     *
     * Absent by default, and `destroy` then refuses. A D1 database is provisioned out of band
     * — by Wrangler, the dashboard, or the API — and a binding gives an application no way to
     * tell a scratch database from the production one it was pointed at by a misconfigured
     * environment variable. Refusing is the same decision the Turso driver made, and for the
     * same reason: a caller who knows which database this is can supply the teardown.
     */
    deleteDatabase?: () => Promise<void>;
    /**
     * See `IDbPlugin.databaseName`. A D1 binding carries no name a plugin can read, so this
     * is the only way to tell two of them apart. Required in practice if one Worker binds
     * more than one D1 database and they share a schema — without it both get the default
     * and would see each other's subscription notifications.
     */
    databaseName?: string;
};

/**
 * SQLite reports a missing table only in the message; there is no code to match on.
 *
 * Structural on `message` rather than `instanceof Error`, because a D1 error crosses a
 * realm boundary in a Worker exactly as a native module's does under Jest.
 */
const isMissingTable = (error: unknown) => {
    const message = (error as { message?: unknown } | null)?.message;

    return typeof message === 'string' && message.includes('no such table');
};

export class D1DbPlugin implements IDbPlugin {

    private readonly database: D1Database;
    private readonly deleteDatabase?: () => Promise<void>;

    /**
     * Derived CREATE TABLE statements, keyed by collection name. Per instance, for the same
     * reason the SQLite plugin's is: a module-global cache keyed by collection name alone
     * would let two bindings serve each other's DDL.
     */
    private readonly tableCache = new Map<string, string>();

    /** See `IDbPlugin.databaseName` and `D1DbPluginOptions.databaseName`. */
    readonly databaseName: string;

    constructor(database: D1Database, options: D1DbPluginOptions = {}) {
        this.database = database;
        this.deleteDatabase = options.deleteDatabase;
        this.databaseName = options.databaseName ?? "d1";
    }

    private resolveTableCreateStatement(schema: CompiledSchema<unknown>): string {
        const cached = this.tableCache.get(schema.collectionName);

        if (cached != null) {
            return cached;
        }

        const createTableSQL = compiledSchemaToSqliteTable(schema);

        this.tableCache.set(schema.collectionName, createTableSQL);

        return createTableSQL;
    }

    private statement(sql: string, params?: readonly unknown[]): D1PreparedStatement {
        const prepared = this.database.prepare(sql);

        // `undefined` is not bindable — the same normalisation every SqliteDriver applies. D1
        // rejects it rather than coercing, so an entity with an unset optional property would
        // fail every save without this.
        return prepared.bind(...(params ?? []).map(value => value === undefined ? null : value));
    }

    /**
     * Refuses a composition whose guarantee this backend cannot keep.
     *
     * `ConcurrencyDbPlugin` works by wrapping a plugin and appending a hidden `__version`
     * column to the schema view it passes down. Its guarantee rests on the inner plugin
     * reading a token-checked UPDATE's affected-row count MID-TRANSACTION and aborting when it
     * is zero. `batch()` makes that impossible: the decision to run the next statement is
     * taken before any result exists.
     *
     * So the choice is to refuse, or to run the UPDATE and discard the check. The second is
     * far worse than an unsupported feature — a lost update is silent, the caller believes
     * they are protected, and the wrapper is only ever added by someone who cares. Re-expressing
     * the check as a statement that *fails* is possible in principle, but it needs a probe
     * table, changes what `sql-core` emits for every engine, and loses which rows conflicted.
     *
     * This fires on the FIRST operation rather than in the constructor, and cannot be moved
     * earlier: a wrapper is invisible to the plugin it wraps until it hands down a schema. A
     * read is refused too, not just a conflicting write — the composition is wrong, and
     * failing on the first query beats failing on the first race.
     */
    private assertNoConcurrency(schemas: SchemaCollection): void {
        // Read through `get(id)`, never by iterating, because that is the only accessor the
        // wrapper augments. `ConcurrencyDbPlugin` proxies the collection and appends the
        // synthetic column inside `get`; iterating hands back the raw schemas, which do not
        // carry it — so an iteration-based check silently finds nothing and the refusal below
        // never fires.
        for (const schemaId of [...schemas.keys()]) {
            const schema = schemas.get(schemaId);

            const hasVersionColumn = schema?.properties.some(
                property => property.getResolvedName() === ConcurrencyDbPlugin.VERSION_COLUMN
            ) === true;

            if (hasVersionColumn) {
                throw new Error(
                    `Cloudflare D1 cannot support optimistic concurrency, so ConcurrencyDbPlugin must not wrap D1DbPlugin.  ` +
                    `A token check requires reading a statement's affected-row count mid-transaction, and D1's batch() applies every statement without stopping to look.  ` +
                    `Collection: ${schema!.collectionName}`
                );
            }
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

        this.runQuery(event)
            .then(rows => {
                // Nested objects, arrays and vectors are stored as JSON columns; decode them
                // before translation or the entity gets a string where a structure belongs.
                const decoded = decodeJsonColumns(rows as TShape, event.operation.schema);
                const translator = new SqlTranslator(event.operation);

                done(PluginEventResult.success(event.id, translator.translate(decoded)));
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    /**
     * A join, done by D1 rather than in memory.
     *
     * The same shape as `SqliteDbPluginBase.queryJoined` — D1 *is* SQLite, so the statement and the
     * row splitting are identical and both come from shared code. Only reaching the engine differs.
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

            // An inner filter with no column to compare against would make the emitted join return
            // rows the inner side's scope excludes. Refusing beats answering wrongly.
            if (canPushDownJoin(join.value) === false) {
                done(PluginEventResult.error(event.id, new Error(
                    `Cannot push this join down to D1: the inner collection has a filter that cannot be expressed as SQL ` +
                    `(an unmapped or renamed property), so the join would return rows its scope excludes.`
                )));
                return;
            }

            const { sql, params } = buildJoinQueryOperation(event.operation, innerSchema);

            this.runJoinQuery(event, innerSchema, sql, params)
                .then(rows => {
                    const tuples = splitJoinRows({
                        rows: rows as UnknownRecord[],
                        kind: join.value.kind,
                        join: join.value,
                        outerSchema: event.operation.schema,
                        innerSchema
                    });

                    const translator = new SqlTranslator(event.operation, { join: true });

                    event.executedQueries.push({ text: sql, parameters: params });

                    done(PluginEventResult.success(event.id, translator.translate(tuples)));
                })
                .catch(error => done(PluginEventResult.error(event.id, error)));
        } catch (error) {
            done(PluginEventResult.error(event.id, error));
        }
    }

    /**
     * The joined read, creating EITHER table on demand.
     *
     * Both, not just the outer one: a join against a collection nothing has written yet is a
     * legitimate query with no pairs, and "no such table" is not the right answer to it. D1 has no
     * multi-statement call, so the two DDL statements go one at a time.
     */
    private async runJoinQuery<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        innerSchema: CompiledSchema<any>,
        sql: string,
        params: readonly unknown[]
    ): Promise<unknown[]> {
        this.assertNoConcurrency(event.schemas);

        try {
            return (await this.statement(sql, params).all()).results;
        } catch (error) {
            if (isMissingTable(error) === false) {
                throw error;
            }

            for (const schema of [event.operation.schema, innerSchema]) {
                await this.statement(this.resolveTableCreateStatement(schema)).all();
            }

            return (await this.statement(sql, params).all()).results;
        }
    }

    /**
     * A read, with the table created on demand.
     *
     * The retry that `batch()` forbids on the write path is fine here: a read is ONE statement,
     * so there is no transaction for a second attempt to break. Creating the table and asking
     * again is exactly what the SQLite plugin does, and a first read of a collection nothing
     * has written yet is expected to miss.
     */
    private async runQuery<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>): Promise<unknown[]> {
        this.assertNoConcurrency(event.schemas);

        const { sql, params } = buildFromQueryOperation(event.operation);

        try {
            const results = (await this.statement(sql, params).all()).results;

            // After the statement ran, not before: RetryDbPlugin re-invokes with the same event.
            event.executedQueries.push({ text: sql, parameters: params });

            return results;
        } catch (error) {
            if (isMissingTable(error) === false) {
                throw error;
            }

            const createTableSql = this.resolveTableCreateStatement(event.operation.schema);

            await this.statement(createTableSql).all();

            const retried = (await this.statement(sql, params).all()).results;

            event.executedQueries.push({ text: sql, parameters: params });

            return retried;
        }
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.persist(event)
            .then(result => done(PluginEventResult.success(event.id, result)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    private async persist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        this.assertNoConcurrency(event.schemas);

        const result = event.operation.toResult();

        // Flattened: one entry per operation, removes before updates before adds within a
        // schema, so a save mixing all three applies all three.
        const operations: { op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes' }[] = [];
        // Deduplicated by collection, because two schemas never share a table and one CREATE
        // per operation would send the same statement several times in a batch.
        const creates = new Map<string, string>();

        for (const [schemaId, changes] of event.operation) {

            if (!changes || changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            const persistOperations = buildFromPersistOperation(schema, changes);
            const createTableSql = this.resolveTableCreateStatement(schema);

            creates.set(schema.collectionName, createTableSql);

            if (persistOperations.removes != null) {
                operations.push({ op: { ...persistOperations.removes, createTableSql, schemaId }, type: 'removes' });
            }

            for (const updateOperation of persistOperations.updates) {
                operations.push({ op: { ...updateOperation, createTableSql, schemaId }, type: 'updates' });
            }

            if (persistOperations.adds != null) {
                operations.push({ op: { ...persistOperations.adds, createTableSql, schemaId }, type: 'adds' });
            }
        }

        if (operations.length === 0) {
            return result;
        }

        // The creates go IN the batch, ahead of the writes, rather than being run first and
        // separately. Two reasons. A separate DDL call is a second round trip on every save,
        // and — more importantly — `CREATE TABLE IF NOT EXISTS` is already idempotent, so
        // prepending it costs nothing and removes the interactive retry the SQLite plugin
        // needs. That retry is the one thing a batch cannot express.
        const createStatements = [...creates.values()].map(sql => this.statement(sql));
        const writeStatements = operations.map(({ op }) => this.statement(op.sql, op.params));

        const batched = await this.database.batch<Record<string, never>>([
            ...createStatements,
            ...writeStatements,
        ]);

        // Results align positionally with the statements sent, so the writes start after the
        // creates. A shorter response than expected means the binding did not honour that,
        // and silently mis-filing rows into the wrong schema's bucket would corrupt the
        // change tracker's view of what was saved.
        const writeResults = batched.slice(createStatements.length);

        if (writeResults.length !== operations.length) {
            throw new Error(
                `Cloudflare D1 returned ${writeResults.length} results for ${operations.length} statements.  ` +
                `A batch must answer positionally, one result per statement.`
            );
        }

        for (let i = 0; i < operations.length; i++) {
            const { op, type } = operations[i];

            // Unreachable while `assertNoConcurrency` guards both entry points, and left as an
            // assertion rather than dropped: a conflict check that silently did not happen is
            // the exact failure this plugin refuses to ship.
            if (op.conflictCheck != null) {
                throw new Error(
                    `A token-checked UPDATE reached the D1 batch path, which cannot verify it.  ` +
                    `Collection: ${event.schemas.get(op.schemaId).collectionName}`
                );
            }

            // Decoded here and not only on the query path: `mergeChanges` deserializes what a
            // plugin echoes back, so a JSON column returned raw reaches the entity's
            // deserializer as a string and throws on the first nested property access.
            const decoded = decodeJsonColumns(
                writeResults[i].results ?? [],
                event.schemas.get(op.schemaId)
            ) as { [x: string]: never }[];
            const bucket = result.get(op.schemaId);

            if (type === 'adds') {
                bucket.adds.push(...decoded);
            } else if (type === 'updates') {
                bucket.updates.push(...decoded);
            } else {
                bucket.removes.push(...decoded);
            }
        }

        return result;
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        if (this.deleteDatabase == null) {
            done(PluginEventResult.error(
                event.id,
                new Error(
                    `Cloudflare D1 will not drop a database from inside an application.  ` +
                    `A binding cannot tell a scratch database from a production one, and the operation is not reversible.  ` +
                    `Pass deleteDatabase to D1DbPlugin if the caller knows which database this is.`
                )
            ));
            return;
        }

        this.deleteDatabase()
            .then(() => done(PluginEventResult.success(event.id)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }
}
