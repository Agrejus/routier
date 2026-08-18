import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import { canPushDownJoin, decodeJsonColumns, splitJoinRows, sqlColumnProperties } from '@routier/sql-plugin-core';
import { buildFromPersistOperation, buildFromQueryOperation, buildJoinQueryOperation, compiledSchemaToMysqlTable, decodeBooleanColumns } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema, SchemaId } from '@routier/core/schema';
import { assertIsNotNull, OptimisticConcurrencyError, UnknownRecord } from '@routier/core';

export interface MysqlDbPluginConfig {
    host?: string;
    port?: number;
    /** Required unless `connectionString` is given, which carries the database itself. */
    database?: string;
    user?: string;
    password?: string;
    /**
     * A `mysql://user:password@host:port/database` URI, passed straight to mysql2.
     *
     * Mutually exclusive with the discrete fields above — supplying both throws rather than
     * silently picking one. There is no correct precedence to guess: a connection string
     * that disagrees with an explicit `host` means the caller believes something untrue
     * about where their data is going.
     */
    connectionString?: string;
    pool?: {
        /**
         * Maximum pooled connections (mysql2's `connectionLimit`). Default 10.
         *
         * There is no `min`: mysql2 opens connections on demand and has no minimum-size
         * concept. The field used to exist here and was silently discarded, which is worse
         * than not offering it.
         */
        max?: number;
    };
}

/**
 * mysql2 throws on an `undefined` bind parameter ("Bind parameters must not contain
 * undefined. To pass SQL NULL specify JS null"). Every other driver the repo targets binds
 * it as NULL, and the builders emit `undefined` for an absent optional property — so without
 * this, an entity that simply omits an optional field fails to insert at all.
 *
 * NULL is the right reading: the column is in the INSERT's column list, so the row needs a
 * value for it, and "no value supplied" is exactly what NULL means.
 */
const bindable = (params: readonly unknown[] | undefined): unknown[] =>
    (params ?? []).map(value => (value === undefined ? null : value));

/**
 * A stable, credential-free identifier for the server and database a config points at.
 * See the identical helper in `PostgresDbPlugin` — the fallback strips the `user:password@`
 * userinfo section so an unparseable connection string still yields a usable identifier
 * instead of throwing from a constructor that previously never threw.
 */
const describeTarget = (config: MysqlDbPluginConfig): string => {
    if (config.connectionString != null) {
        try {
            const url = new URL(config.connectionString);
            return `mysql://${url.hostname}:${url.port || 3306}${url.pathname}`;
        } catch {
            return config.connectionString.replace(/\/\/[^@/]*@/, '//');
        }
    }

    return `mysql://${config.host || 'localhost'}:${config.port || 3306}/${config.database}`;
};

export class MysqlDbPlugin implements IDbPlugin {

    private pool: Pool;
    private tableCache: Record<string, string> = {};

    /**
     * See `IDbPlugin.databaseName`. Host, port and database rather than the bare name,
     * because `mydb` on two servers is two databases.
     */
    readonly databaseName: string;

    constructor(config: MysqlDbPluginConfig) {
        this.databaseName = describeTarget(config);

        const hasDiscreteTarget = config.host != null
            || config.port != null
            || config.database != null
            || config.user != null
            || config.password != null;

        if (config.connectionString != null && hasDiscreteTarget) {
            throw new Error(
                'MysqlDbPlugin: `connectionString` and the discrete connection fields ' +
                '(host, port, database, user, password) are mutually exclusive. ' +
                'Supply one or the other — silently preferring either would connect somewhere ' +
                'the configuration says it should not.'
            );
        }

        if (config.connectionString == null && config.database == null) {
            throw new Error('MysqlDbPlugin: `database` is required when `connectionString` is not given.');
        }

        this.pool = config.connectionString != null
            ? createPool({
                uri: config.connectionString,
                connectionLimit: config.pool?.max || 10,
                waitForConnections: true,
                timezone: 'Z',
            })
            : createPool({
                host: config.host || 'localhost',
                port: config.port || 3306,
                database: config.database,
                user: config.user,
                password: config.password,
                connectionLimit: config.pool?.max || 10,
                waitForConnections: true,
                // DATETIME columns are written as UTC (see the dialect's encodeDate), so
                // mysql2 has to read them back as UTC too. Its default is the process's
                // local zone, which silently shifts every date by the machine's offset.
                timezone: 'Z',
            });
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        if (this.tableCache[schema.collectionName] == null) {
            this.tableCache[schema.collectionName] = compiledSchemaToMysqlTable(schema);
        }
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        if (event.operation.options.has("join")) {
            this.queryJoined(event, done);
            return;
        }

        this.resolveSchema(event.operation.schema);
        const translator = new SqlTranslator(event.operation);

        this._doQueryWork<TRoot, TShape>(event, (result) => {
            if (result.ok === "error") {
                done(PluginEventResult.error(event.id, result.error));
                return;
            }

            // Nested objects and arrays are stored as JSON columns (see
            // toColumnAssignments); decode them before translation so the entity gets a
            // structure back rather than a JSON string. Skips properties whose schema
            // does its own deserialization.
            const decoded = decodeBooleanColumns(
                decodeJsonColumns(result.data, event.operation.schema),
                event.operation.schema
            );
            const data = translator.translate(decoded);

            done(PluginEventResult.success(event.id, data));
        });
    }

    /**
     * A join, done by MySQL rather than in memory.
     *
     * `splitJoinRows` cuts each flat row into two halves and deserializes each against its own
     * schema, so the translator receives tuples already — hence `{ join: true }` and a pass-through.
     *
     * No `decodeBooleanColumns` call here, unlike the single-table path: `decodeJsonColumns` — which
     * `splitJoinRows` runs per side — already turns a numeric column back into a boolean, and it is
     * MySQL's `TINYINT(1)` that made that necessary in the first place.
     */
    private queryJoined<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
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
                    `Cannot push this join down to MySQL: the inner collection has a filter that cannot be expressed as SQL ` +
                    `(an unmapped or renamed property), so the join would return rows its scope excludes.`
                )));
                return;
            }

            this.resolveSchema(event.operation.schema);
            this.resolveSchema(innerSchema);

            const translator = new SqlTranslator(event.operation, { join: true });

            this._doJoinQueryWork(event, innerSchema, (result) => {
                if (result.ok === "error") {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                const tuples = splitJoinRows({
                    rows: result.data as UnknownRecord[],
                    kind: join.value.kind,
                    join: join.value,
                    outerSchema: event.operation.schema,
                    innerSchema
                });

                done(PluginEventResult.success(event.id, translator.translate(tuples)));
            });
        } catch (error) {
            done(PluginEventResult.error(event.id, error));
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.pool.end().then(() => {
            done(PluginEventResult.success(event.id));
        }).catch((err) => {
            done(PluginEventResult.error(event.id, err));
        });
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        this._doPersistWork(event, (result) => {
            if (result.ok === "error") {
                done(PluginEventResult.error(event.id, result.error));
                return;
            }

            done(PluginEventResult.success(event.id, result.data));
        });
    }

    private resolveTableCreateStatement(schema: CompiledSchema<unknown>): string {
        const collectionName = schema.collectionName;
        if (this.tableCache[collectionName]) {
            return this.tableCache[collectionName];
        }

        const createTableSQL = compiledSchemaToMysqlTable(schema);
        this.tableCache[collectionName] = createTableSQL;

        return createTableSQL;
    }

    private async _doPersistWork(
        event: DbPluginBulkPersistEvent,
        done: CallbackResult<BulkPersistResult>
    ): Promise<void> {
        let connection: PoolConnection | undefined;
        try {
            connection = await this.pool.getConnection();

            const result = event.operation.toResult();

            const ensureTable = async (schemaId: SchemaId, createTableSql: string) => {
                const [tables] = await connection!.execute(
                    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                    [event.schemas.get(schemaId)!.collectionName]
                ) as [Array<{ TABLE_NAME: string }>, any];

                if (tables.length === 0) {
                    await connection!.query(createTableSql);
                }
            };

            // DDL BEFORE the transaction, for every collection in the event.
            //
            // MySQL commits the open transaction implicitly when it runs DDL. Creating a
            // table from inside the transaction therefore committed whatever had already
            // been written and started an untracked one, so a later failure rolled back
            // nothing — the partial save was already durable. Table creation is idempotent
            // and independent of the batch's data, so it belongs outside.
            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                await ensureTable(schemaId, compiledSchemaToMysqlTable(event.schemas.get(schemaId)!));
            }

            await connection.beginTransaction();

            /** Storage-side column list — one column per root property, like the DDL. */
            const selectColumns = (schemaId: SchemaId) =>
                sqlColumnProperties(event.schemas.get(schemaId)!).map(p => `\`${p.getResolvedName()}\``).join(', ');

            // Echoed rows go through decodeJsonColumns before mergeChanges sees them: a
            // JSON column returned as a raw string reaches the entity's deserializer as a
            // string and throws on the first nested property access.
            const collect = (schemaId: SchemaId, bucket: 'adds' | 'updates' | 'removes', rows: unknown[]) => {
                const schema = event.schemas.get(schemaId)!;
                const decoded = decodeBooleanColumns(
                    decodeJsonColumns(rows, schema),
                    schema
                ) as { [x: string]: never; }[];
                result.get(schemaId)[bucket].push(...decoded);
            };

            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get(schemaId);
                const { adds, updates, removes } = buildFromPersistOperation(schema, changes);
                const table = `\`${schema.collectionName}\``;
                const idColumn = `\`${schema.idProperties[0].getResolvedName()}\``;

                // Removes first, then updates, then adds — same order as the other SQL
                // plugins. The echo is read BEFORE the delete; afterwards the rows are gone.
                if (removes != null) {
                    const [rows] = await connection.execute(removes.selectSql, bindable(removes.params));
                    collect(schemaId, 'removes', rows as unknown[]);
                    await connection.execute(removes.sql, bindable(removes.params));
                }

                for (const update of updates) {
                    const [updateResult] = await connection.execute(update.sql, bindable(update.params));

                    // A token-checked UPDATE that matched no row lost the race: another
                    // writer changed the row after this one read it. Postgres detects this
                    // from an empty RETURNING set; MySQL has none, so it comes from
                    // affectedRows. Throwing rolls the whole transaction back, which is the
                    // contract — a conflicted save writes nothing anywhere.
                    if (update.conflictCheck != null
                        && (updateResult as { affectedRows?: number }).affectedRows === 0) {
                        throw new OptimisticConcurrencyError(
                            schema.collectionName,
                            [update.conflictCheck.id as never]
                        );
                    }

                    // Select back on the FULL key of each row — an OR of per-row
                    // conjunctions, the same shape the composite add path uses below.
                    // `id IN (...)` over one component of a composite key echoes every
                    // row that shares it.
                    const clauses = update.keyTuples.map(tuple =>
                        `(${Object.keys(tuple).map(column => `\`${column}\` = ?`).join(' AND ')})`
                    );
                    const [rows] = await connection.execute(
                        `SELECT ${selectColumns(schemaId)} FROM ${table} WHERE ${clauses.join(' OR ')}`,
                        update.keyTuples.flatMap(tuple => Object.values(tuple))
                    );
                    collect(schemaId, 'updates', rows as unknown[]);
                }

                if (adds != null) {
                    const [insertResult] = await connection.execute(adds.sql, bindable(adds.params));
                    const selectBack = adds.selectBack;

                    let selectSql: string;
                    let selectParams: unknown[];

                    if (selectBack.mode === 'insert-id') {
                        // A simple multi-row INSERT allocates a consecutive AUTO_INCREMENT
                        // block, so the inserted rows are insertId .. insertId + n - 1.
                        //
                        // This holds for `innodb_autoinc_lock_mode` 0 or 1 with one INSERT
                        // statement per batch, which is what the plugin emits. Under mode 2
                        // (interleaved) or a non-1 `auto_increment_increment`, the block is
                        // not contiguous — see the row-count assertion below, which is what
                        // turns that configuration into a loud failure instead of a
                        // silently wrong echo. The supported configuration is documented in
                        // the plugin README.
                        const firstId = (insertResult as { insertId: number }).insertId;
                        selectSql = `SELECT ${selectColumns(schemaId)} FROM ${table} WHERE ${idColumn} BETWEEN ? AND ?`;
                        selectParams = [firstId, firstId + selectBack.rowCount - 1];
                    } else if (selectBack.mode === 'by-key') {
                        const placeholders = selectBack.ids.map(() => '?').join(', ');
                        selectSql = `SELECT ${selectColumns(schemaId)} FROM ${table} WHERE ${idColumn} IN (${placeholders})`;
                        selectParams = selectBack.ids;
                    } else {
                        const clauses = selectBack.keyTuples.map(tuple =>
                            `(${Object.keys(tuple).map(column => `\`${column}\` = ?`).join(' AND ')})`
                        );
                        selectSql = `SELECT ${selectColumns(schemaId)} FROM ${table} WHERE ${clauses.join(' OR ')}`;
                        selectParams = selectBack.keyTuples.flatMap(tuple => Object.values(tuple));
                    }

                    const [rows] = await connection.execute(selectSql, bindable(selectParams));
                    const echoed = rows as unknown[];

                    // MySQL has no RETURNING, so the echo is a second statement whose result
                    // is only ASSUMED to be the rows just written. Where that assumption can
                    // break — the contiguous auto-increment block above — say so loudly.
                    // The alternative is a save that reports success while handing the
                    // change tracker somebody else's rows, or too few of them.
                    if (selectBack.mode === 'insert-id' && echoed.length !== selectBack.rowCount) {
                        throw new Error(
                            `MySQL select-back returned ${echoed.length} row(s) for an INSERT of ` +
                            `${selectBack.rowCount}. The plugin reads inserted rows back by their ` +
                            `AUTO_INCREMENT range, which requires a contiguous block: set ` +
                            `innodb_autoinc_lock_mode to 0 or 1 and auto_increment_increment to 1. ` +
                            `Nothing was committed.`
                        );
                    }

                    collect(schemaId, 'adds', echoed);
                }
            }

            // Commit transaction
            await connection.commit();
            connection.release();
            done(Result.success(result));
        } catch (err) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch {
                    // The original error is the one worth reporting; a rollback that also
                    // fails does not change what the caller has to do.
                } finally {
                    // In `finally`, because a throwing rollback used to skip the release
                    // entirely — every failed save then permanently cost the pool one
                    // connection, and enough of them deadlocked the plugin.
                    connection.release();
                }
            }
            done(Result.error(err));
        }
    }

    /**
     * The joined read, creating EITHER table on demand.
     *
     * Both, not just the outer one: a join against a collection nothing has written yet is a
     * legitimate query with no pairs. One `query()` call per DDL statement — mysql2 runs a single
     * statement per call unless `multipleStatements` is enabled, which is a SQL injection surface
     * nobody should turn on (see known-defects #64).
     */
    private async _doJoinQueryWork<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        innerSchema: CompiledSchema<any>,
        done: CallbackResult<TShape>
    ): Promise<void> {
        let connection: PoolConnection | undefined;
        try {
            connection = await this.pool.getConnection();

            for (const schema of [event.operation.schema, innerSchema]) {
                const [tables] = await connection.execute(
                    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                    [schema.collectionName]
                ) as [Array<{ TABLE_NAME: string }>, any];

                if (tables.length === 0) {
                    await connection.query(this.resolveTableCreateStatement(schema));
                }
            }

            const { params, sql } = buildJoinQueryOperation(event.operation, innerSchema);
            const [rows] = await connection.execute(sql, bindable(params));

            // After the statement ran, not before: RetryDbPlugin re-invokes with the same event.
            event.executedQueries.push({ text: sql, parameters: params });

            connection.release();
            done(Result.success(rows as TShape));
        } catch (err) {
            if (connection) {
                connection.release();
            }
            done(Result.error(err));
        }
    }

    private async _doQueryWork<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: CallbackResult<TShape>
    ): Promise<void> {
        let connection: PoolConnection | undefined;
        try {
            connection = await this.pool.getConnection();

            const createTableSQL = this.resolveTableCreateStatement(event.operation.schema);
            const { params, sql } = buildFromQueryOperation(event.operation);

            // Check if table exists
            const [tables] = await connection.execute(
                `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                [event.operation.schema.collectionName]
            ) as [Array<{ TABLE_NAME: string }>, any];

            if (tables.length === 0) {
                // Table doesn't exist, create it
                await connection.query(createTableSQL);
            }

            // Execute query
            const [rows] = await connection.execute(sql, bindable(params));

            // After the statement ran, not before: RetryDbPlugin re-invokes with the same event.
            event.executedQueries.push({ text: sql, parameters: params });

            connection.release();
            done(Result.success(rows as TShape));
        } catch (err) {
            if (connection) {
                connection.release();
            }
            done(Result.error(err));
        }
    }
}
