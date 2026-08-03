import { Pool } from 'pg';
import { decodeJsonColumns } from '@routier/sql-plugin-core';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToPostgresTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from '@routier/core/plugins';
import { PostgresSqlTranslator } from './PostgresSqlTranslator';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { logger } from '@routier/core/utilities';
import { SqlPersistOperation } from './types';

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

        // An idle client losing its connection (server restart/shutdown) emits 'error'
        // on the pool; without a handler that is an unhandled error that kills the
        // process. The pool discards the dead client and creates a new one on demand
        this.pool.on('error', (err) => {
            logger.warn('[DB] PostgreSQL pool error on idle client', { error: err });
        });
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        if (this.tableCache[schema.collectionName] == null) {
            this.tableCache[schema.collectionName] = compiledSchemaToPostgresTable(schema);
        }
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.resolveSchema(event.operation.schema);
        const translator = new PostgresSqlTranslator(event.operation);

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

            // Flattened: one entry per operation, removes before updates before adds within
            // a schema, so a save mixing all three applies all three (grouping them and
            // executing only one per group silently dropped the rest)
            const operations: { op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes' }[] = [];

            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get(schemaId);
                const persistOperations = buildFromPersistOperation(schema, changes);
                const createTableSql = compiledSchemaToPostgresTable(schema);

                if (persistOperations.removes != null) {
                    operations.push({ op: { ...persistOperations.removes, createTableSql, schemaId }, type: 'removes' });
                }

                if (persistOperations.updates != null) {
                    operations.push({ op: { ...persistOperations.updates, createTableSql, schemaId }, type: 'updates' });
                }

                if (persistOperations.adds != null) {
                    operations.push({ op: { ...persistOperations.adds, createTableSql, schemaId }, type: 'adds' });
                }
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

                    const executeOperation = (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes') => {
                        // Log SQL and parameters for debugging
                        console.log(`[DB] PostgreSQL ${type} operation:`, {
                            sql: op.sql,
                            params: op.params || [],
                            paramsCount: (op.params || []).length,
                            schemaId: op.schemaId,
                        });

                        // PostgreSQL aborts the whole transaction on the first error, so the
                        // create-table-on-demand recovery below can only work if the failed
                        // write is rolled back to a savepoint first. Without it, the CREATE
                        // TABLE runs inside an aborted transaction and fails with 25P02.
                        const savepoint = `sp_${index}_${type}`;

                        client.query(`SAVEPOINT ${savepoint}`, (savepointErr) => {
                            if (savepointErr) {
                                client.query('ROLLBACK', () => {
                                    release();
                                    done(Result.error(savepointErr));
                                });
                                return;
                            }

                        client.query(op.sql, op.params || [], (err, queryResult) => {
                            if (err && err.message.includes('relation') && err.message.includes('does not exist')) {
                                // Table doesn't exist: roll back the failed write, then
                                // create the table and retry inside the same transaction
                                client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`, (rollbackToErr) => {
                                if (rollbackToErr) {
                                    client.query('ROLLBACK', () => {
                                        release();
                                        done(Result.error(rollbackToErr));
                                    });
                                    return;
                                }

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
                        });
                    };

                    executeOperation(operations[index].op, operations[index].type);
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
