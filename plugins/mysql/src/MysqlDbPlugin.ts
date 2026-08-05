import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import { decodeJsonColumns, sqlColumnProperties } from '@routier/sql-plugin-core';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToMysqlTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema, SchemaId } from '@routier/core/schema';

export interface MysqlDbPluginConfig {
    host?: string;
    port?: number;
    database: string;
    user?: string;
    password?: string;
    connectionString?: string;
    pool?: {
        min?: number;
        max?: number;
    };
}

export class MysqlDbPlugin implements IDbPlugin {

    private pool: Pool;
    private tableCache: Record<string, string> = {};

    constructor(config: MysqlDbPluginConfig) {
        this.pool = createPool({
            host: config.host || 'localhost',
            port: config.port || 3306,
            database: config.database,
            user: config.user,
            password: config.password,
            connectionLimit: config.pool?.max || 10,
            waitForConnections: true,
        });
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        if (this.tableCache[schema.collectionName] == null) {
            this.tableCache[schema.collectionName] = compiledSchemaToMysqlTable(schema);
        }
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
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
            const decoded = decodeJsonColumns(result.data, event.operation.schema);
            const data = translator.translate(decoded);

            done(PluginEventResult.success(event.id, data));
        });
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
            await connection.beginTransaction();

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

            /** Storage-side column list — one column per root property, like the DDL. */
            const selectColumns = (schemaId: SchemaId) =>
                sqlColumnProperties(event.schemas.get(schemaId)!).map(p => `\`${p.getResolvedName()}\``).join(', ');

            // Echoed rows go through decodeJsonColumns before mergeChanges sees them: a
            // JSON column returned as a raw string reaches the entity's deserializer as a
            // string and throws on the first nested property access.
            const collect = (schemaId: SchemaId, bucket: 'adds' | 'updates' | 'removes', rows: unknown[]) => {
                const decoded = decodeJsonColumns(rows, event.schemas.get(schemaId)!) as { [x: string]: never; }[];
                result.get(schemaId)[bucket].push(...decoded);
            };

            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get(schemaId);
                const { adds, updates, removes } = buildFromPersistOperation(schema, changes);
                const createTableSql = compiledSchemaToMysqlTable(schema);
                const table = `\`${schema.collectionName}\``;
                const idColumn = `\`${schema.idProperties[0].getResolvedName()}\``;

                await ensureTable(schemaId, createTableSql);

                // Removes first, then updates, then adds — same order as the other SQL
                // plugins. The echo is read BEFORE the delete; afterwards the rows are gone.
                if (removes != null) {
                    const [rows] = await connection.execute(removes.selectSql, removes.params);
                    collect(schemaId, 'removes', rows as unknown[]);
                    await connection.execute(removes.sql, removes.params);
                }

                for (const update of updates) {
                    await connection.execute(update.sql, update.params);

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
                    const [insertResult] = await connection.execute(adds.sql, adds.params);
                    const selectBack = adds.selectBack;

                    let selectSql: string;
                    let selectParams: unknown[];

                    if (selectBack.mode === 'insert-id') {
                        // A simple multi-row INSERT allocates a consecutive AUTO_INCREMENT
                        // block, so the inserted rows are insertId .. insertId + n - 1.
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

                    const [rows] = await connection.execute(selectSql, selectParams);
                    collect(schemaId, 'adds', rows as unknown[]);
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
                    connection.release();
                } catch  {
                    // Ignore rollback errors
                }
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
            const [rows] = await connection.execute(sql, params || []);
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
