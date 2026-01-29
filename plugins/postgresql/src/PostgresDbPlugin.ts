import { Pool } from 'pg';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToPostgresTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { SqlPersistOperation } from './types';

const tableCache: Record<string, string> = {};

export interface PostgresDbPluginConfig {
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

export class PostgresDbPlugin implements IDbPlugin {

    private pool: Pool;
    private tableCache: Record<string, string> = {};

    constructor(config: PostgresDbPluginConfig) {
        this.pool = new Pool({
            host: config.host || 'localhost',
            port: config.port || 5432,
            database: config.database,
            user: config.user,
            password: config.password,
            connectionString: config.connectionString,
            min: config.pool?.min || 2,
            max: config.pool?.max || 10,
        });
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        if (this.tableCache[schema.collectionName] == null) {
            this.tableCache[schema.collectionName] = compiledSchemaToPostgresTable(schema);
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
        this.pool.end()
            .then(() => {
                done(PluginEventResult.success(event.id));
            })
            .catch((err) => {
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

        const createTableSQL = compiledSchemaToPostgresTable(schema);
        this.tableCache[collectionName] = createTableSQL;

        return createTableSQL;
    }

    private _doPersistWork(
        event: DbPluginBulkPersistEvent,
        done: CallbackResult<BulkPersistResult>
    ): void {
        this.pool.connect((err, client, release) => {
            if (err) {
                return done(Result.error(err));
            }

            const result = event.operation.toResult();
            const operations: { adds: SqlPersistOperation | null, updates: SqlPersistOperation | null, removes: SqlPersistOperation | null }[] = [];

            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get(schemaId);
                const persistOperations = buildFromPersistOperation(schema, changes);
                const createTableSql = compiledSchemaToPostgresTable(schema);

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

            // Begin transaction
            client.query('BEGIN', (beginErr) => {
                if (beginErr) {
                    release();
                    return done(Result.error(beginErr));
                }

                const executeNext = (index: number) => {
                    if (index >= operations.length) {
                        // All operations completed, commit
                        client.query('COMMIT', (commitErr) => {
                            if (commitErr) {
                                client.query('ROLLBACK', () => {
                                    release();
                                    done(Result.error(commitErr));
                                });
                                return;
                            }
                            release();
                            done(Result.success(result));
                        });
                        return;
                    }

                    const operationGroup = operations[index];

                    const executeOperation = (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes') => {
                        // Log SQL and parameters for debugging
                        console.log(`[DB] PostgreSQL ${type} operation:`, {
                            sql: op.sql,
                            params: op.params || [],
                            paramsCount: (op.params || []).length,
                            schemaId: op.schemaId,
                        });

                        client.query(op.sql, op.params || [], (err, queryResult) => {
                            if (err && err.message.includes('relation') && err.message.includes('does not exist')) {
                                // Table doesn't exist, create it and retry
                                client.query(op.createTableSql, (createErr) => {
                                    if (createErr) {
                                        client.query('ROLLBACK', () => {
                                            release();
                                            done(Result.error(createErr));
                                        });
                                        return;
                                    }

                                    // Retry the operation after table creation
                                    console.log(`[DB] PostgreSQL ${type} retry after table creation:`, {
                                        sql: op.sql,
                                        params: op.params || [],
                                        paramsCount: (op.params || []).length,
                                    });
                                    client.query(op.sql, op.params || [], (retryErr, retryResult) => {
                                        if (retryErr) {
                                            client.query('ROLLBACK', () => {
                                                release();
                                                done(Result.error(retryErr));
                                            });
                                            return;
                                        }

                                        if (type === "adds") {
                                            const { adds } = result.get(op.schemaId);
                                            adds.push(...retryResult.rows as { [x: string]: never; }[]);
                                        }

                                        if (type === "updates") {
                                            const { updates } = result.get(op.schemaId);
                                            updates.push(...retryResult.rows as { [x: string]: never; }[]);
                                        }

                                        if (type === "removes") {
                                            const { removes } = result.get(op.schemaId);
                                            removes.push(...retryResult.rows as { [x: string]: never; }[]);
                                        }

                                        executeNext(index + 1);
                                    });
                                });
                            } else if (err) {
                                // Other error, rollback
                                client.query('ROLLBACK', () => {
                                    release();
                                    done(Result.error(err));
                                });
                            } else {
                                // Success, continue to next operation
                                if (type === "adds") {
                                    const { adds } = result.get(op.schemaId);
                                    adds.push(...queryResult.rows as { [x: string]: never; }[]);
                                }

                                if (type === "updates") {
                                    const { updates } = result.get(op.schemaId);
                                    updates.push(...queryResult.rows as { [x: string]: never; }[]);
                                }

                                if (type === "removes") {
                                    const { removes } = result.get(op.schemaId);
                                    removes.push(...queryResult.rows as { [x: string]: never; }[]);
                                }

                                executeNext(index + 1);
                            }
                        });
                    };

                    // Always execute removes first
                    if (operationGroup.removes) {
                        executeOperation(operationGroup.removes, 'removes');
                    } else if (operationGroup.updates) {
                        executeOperation(operationGroup.updates, 'updates');
                    } else if (operationGroup.adds) {
                        executeOperation(operationGroup.adds, 'adds');
                    } else {
                        executeNext(index + 1);
                    }
                };

                // Start executing operations
                executeNext(0);
            });
        });
    }

    private _doQueryWork<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: CallbackResult<TShape>
    ) {
        this.pool.connect((err, client, release) => {
            if (err) {
                const nodeErr = err as NodeJS.ErrnoException;
                const isConnectionError = nodeErr.message?.includes('ECONNREFUSED') || 
                                         nodeErr.message?.includes('connect') ||
                                         nodeErr.code === 'ECONNREFUSED';
                
                if (isConnectionError) {
                    console.error('[DB] PostgreSQL connection error:', {
                        code: nodeErr.code,
                        message: nodeErr.message,
                        host: this.pool.options.host,
                        port: this.pool.options.port,
                        database: this.pool.options.database,
                        user: this.pool.options.user,
                    });
                }
                return done(Result.error(err));
            }

            const createTableSQL = this.resolveTableCreateStatement(event.operation.schema);
            const { params, sql } = buildFromQueryOperation(event.operation);

            // Log SQL and parameters for debugging
            console.log('[DB] PostgreSQL query:', {
                sql,
                params: params || [],
                paramsCount: (params || []).length,
                table: event.operation.schema.collectionName,
            });

            client.query(sql, params || [], (queryErr, queryResult) => {
                if (queryErr && queryErr.message.includes('relation') && queryErr.message.includes('does not exist')) {
                    // Table doesn't exist, create it and retry
                    client.query(createTableSQL, (createErr) => {
                        if (createErr) {
                            release();
                            return done(Result.error(createErr));
                        }

                        // Retry the SELECT after table creation
                        console.log('[DB] PostgreSQL query retry after table creation:', {
                            sql,
                            params: params || [],
                            paramsCount: (params || []).length,
                        });
                        client.query(sql, params || [], (retryErr, retryResult) => {
                            release();
                            if (retryErr) {
                                return done(Result.error(retryErr));
                            }
                            done(Result.success(retryResult.rows as TShape));
                        });
                    });
                } else {
                    release();
                    if (queryErr) {
                        done(Result.error(queryErr));
                    } else {
                        done(Result.success(queryResult.rows as TShape));
                    }
                }
            });
        });
    }
}
