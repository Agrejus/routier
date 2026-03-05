import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToMysqlTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { SqlPersistOperation } from './types';

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

            const data = translator.translate(result.data);

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
            const operations: { adds: SqlPersistOperation | null, updates: SqlPersistOperation | null, removes: SqlPersistOperation | null }[] = [];

            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get(schemaId);
                const persistOperations = buildFromPersistOperation(schema, changes);
                const createTableSql = compiledSchemaToMysqlTable(schema);

                operations.push({
                    adds: persistOperations.adds != null ? {
                        ...persistOperations.adds,
                        createTableSql,
                        schemaId
                    } : null,
                    updates: persistOperations.updates != null ? {
                        ...persistOperations.updates,
                        createTableSql,
                        schemaId
                    } : null,
                    removes: persistOperations.removes != null ? {
                        ...persistOperations.removes,
                        createTableSql,
                        schemaId
                    } : null
                });
            }

            // Execute operations sequentially
            for (let index = 0; index < operations.length; index++) {
                const operationGroup = operations[index];

                const executeOperation = async (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes') => {
                    try {
                        // Check if table exists, create if not
                        const [tables] = await connection!.execute(
                            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                            [event.schemas.get(op.schemaId)!.collectionName]
                        ) as [Array<{ TABLE_NAME: string }>, any];

                        if (tables.length === 0) {
                            // Table doesn't exist, create it
                            await connection!.query(op.createTableSql);
                        }

                        // Execute the operation
                        const [rows] = await connection!.execute(op.sql, op.params || []);

                        // MySQL doesn't support RETURNING, so we need to SELECT back the inserted/updated rows
                        if (type === "adds" || type === "updates") {
                            const schema = event.schemas.get(op.schemaId);
                            const idProperties = schema.idProperties;

                            // For adds, get the last insert ID or select by inserted values
                            // For updates, select by IDs
                            let selectSql: string;
                            let selectParams: any[] = [];

                            if (type === "adds") {
                                // Get inserted rows - MySQL returns insertId for AUTO_INCREMENT
                                // For non-AUTO_INCREMENT, we need to select by the inserted values
                                const insertId = (rows as any).insertId;
                                if (insertId) {
                                    selectSql = `SELECT * FROM \`${schema.collectionName}\` WHERE \`${idProperties[0].name}\` = ?`;
                                    selectParams = [insertId];
                                } else {
                                    // Select all inserted rows (this is approximate - may need refinement)
                                    const allColumns = schema.properties.map(p => `\`${p.name}\``).join(', ');
                                    selectSql = `SELECT ${allColumns} FROM \`${schema.collectionName}\` ORDER BY \`${idProperties[0].name}\` DESC LIMIT ${op.params!.length / (schema.properties.length - schema.idProperties.filter(p => p.isIdentity).length)}`;
                                }
                            } else {
                                // For updates, select by IDs
                                const idColumn = idProperties[0].name;
                                const idValues: any[] = [];
                                for (let i = 0; i < op.params!.length; i += 2) {
                                    idValues.push(op.params![i]);
                                }
                                const placeholders = idValues.map(() => '?').join(', ');
                                selectSql = `SELECT * FROM \`${schema.collectionName}\` WHERE \`${idColumn}\` IN (${placeholders})`;
                                selectParams = idValues;
                            }

                            const [selectedRows] = await connection!.execute(selectSql, selectParams);

                            if (type === "adds") {
                                const { adds } = result.get(op.schemaId);
                                adds.push(...(selectedRows as { [x: string]: never; }[]));
                            }

                            if (type === "updates") {
                                const { updates } = result.get(op.schemaId);
                                updates.push(...(selectedRows as { [x: string]: never; }[]));
                            }
                        }

                        if (type === "removes") {
                            const { removes } = result.get(op.schemaId);
                            // MySQL doesn't support RETURNING, so select before delete
                            const schema = event.schemas.get(op.schemaId);
                            const idProperties = schema.idProperties;
                            const idColumn = idProperties[0].name;

                            // Extract ID values from params (they're in the WHERE clause)
                            const idValues: any[] = [];
                            for (let i = 0; i < op.params!.length; i++) {
                                idValues.push(op.params![i]);
                            }

                            if (idValues.length > 0) {
                                const placeholders = idValues.map(() => '?').join(', ');
                                const selectSql = `SELECT * FROM \`${schema.collectionName}\` WHERE \`${idColumn}\` IN (${placeholders})`;
                                const [selectedRows] = await connection!.execute(selectSql, idValues);
                                removes.push(...(selectedRows as { [x: string]: never; }[]));
                            }
                        }
                    } catch (err: any) {
                        if (err.message && err.message.includes("doesn't exist")) {
                            // Table doesn't exist, create it and retry
                            await connection!.query(op.createTableSql);
                            // Retry the operation
                            return executeOperation(op, type);
                        }
                        throw err;
                    }
                };

                // Always execute removes first
                if (operationGroup.removes) {
                    await executeOperation(operationGroup.removes, 'removes');
                }
                if (operationGroup.updates) {
                    await executeOperation(operationGroup.updates, 'updates');
                }
                if (operationGroup.adds) {
                    await executeOperation(operationGroup.adds, 'adds');
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
