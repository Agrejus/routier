import sqlite3 from 'sqlite3';
import fs from 'fs';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToSqliteTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, SqlTranslator } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { SqlPersistOperation } from './types';

const tableCache: Record<string, string> = {};

export class SqliteDbPlugin implements IDbPlugin {

    private fileName: string;

    constructor(fileName: string) {
        this.fileName = fileName;
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        if (tableCache[schema.collectionName] == null) {
            tableCache[schema.collectionName] = compiledSchemaToSqliteTable(schema);
        }
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<TShape>): void {
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
        try {
            // First, close any open connections to the database
            const db = new sqlite3.Database(this.fileName);

            db.close((err) => {
                if (err) {
                    // Even if close fails, try to delete the file
                    this._deleteDatabaseFile(event, done);
                    return;
                }

                // Database closed successfully, now delete the file
                this._deleteDatabaseFile(event, done);
            });
        } catch (error) {
            // If we can't even create a connection, try to delete the file anyway
            this._deleteDatabaseFile(event, done);
        }
    }

    private _deleteDatabaseFile(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        fs.unlink(this.fileName, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                // ENOENT means "file doesn't exist" which is fine for destroy
                done(PluginEventResult.error(event.id, unlinkErr));
                return;
            }
            done(PluginEventResult.success(event.id)); // Success - file deleted or didn't exist
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
        if (tableCache[collectionName]) {
            return tableCache[collectionName];
        }

        const createTableSQL = compiledSchemaToSqliteTable(schema);

        tableCache[collectionName] = createTableSQL;

        return createTableSQL;
    }

    private _doPersistWork(
        event: DbPluginBulkPersistEvent,
        done: CallbackResult<BulkPersistResult>
    ): void {

        const db = new sqlite3.Database(this.fileName);
        const result = event.operation.toResult();
        const operations: { adds: SqlPersistOperation | null, updates: SqlPersistOperation | null, removes: SqlPersistOperation | null }[] = [];

        for (const [schemaId, changes] of event.operation) {

            if (changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            const persistOperations = buildFromPersistOperation(schema, changes);
            const createTableSql = compiledSchemaToSqliteTable(schema);

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

        db.serialize(() => {
            db.run('BEGIN IMMEDIATE TRANSACTION');

            // Execute all operations sequentially
            const executeNext = (index: number) => {
                if (index >= operations.length) {
                    // All operations completed, commit
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            db.run('ROLLBACK', () => {
                                db.close(() => done(Result.error(commitErr)));
                            });
                            return;
                        }
                        db.close(() => done(Result.success(result)));
                    });
                    return;
                }

                const operationGroup = operations[index];

                // Execute adds operation
                const executeOperation = (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes') => {
                    db.all(op.sql, op.params || [], (err, rows) => {
                        if (err && err.message.includes('no such table')) {
                            // Table doesn't exist, create it and retry
                            db.run(op.createTableSql, (createErr) => {
                                if (createErr) {
                                    db.run('ROLLBACK', () => {
                                        db.close(() => done(Result.error(createErr)));
                                    });
                                    return;
                                }

                                // Retry the operation after table creation
                                db.all(op.sql, op.params || [], (retryErr, retryRows) => {
                                    if (retryErr) {
                                        db.run('ROLLBACK', () => {
                                            db.close(() => done(Result.error(retryErr)));
                                        });
                                        return;
                                    }

                                    if (type === "adds") {
                                        const { adds } = result.get(op.schemaId);
                                        adds.push(...retryRows as { [x: string]: never; }[]);
                                    }

                                    if (type === "updates") {
                                        const { updates } = result.get(op.schemaId);
                                        updates.push(...retryRows as { [x: string]: never; }[]);
                                    }

                                    if (type === "removes") {
                                        const { removes } = result.get(op.schemaId);
                                        removes.push(...retryRows as { [x: string]: never; }[]);
                                    }

                                    executeNext(index + 1);
                                });
                            });
                        } else if (err) {
                            // Other error, rollback
                            db.run('ROLLBACK', () => {
                                db.close(() => done(Result.error(err)));
                            });
                        } else {
                            // Success, continue to next operation
                            if (type === "adds") {
                                const { adds } = result.get(op.schemaId);
                                adds.push(...rows as { [x: string]: never; }[]);
                            }

                            if (type === "updates") {
                                const { updates } = result.get(op.schemaId);
                                updates.push(...rows as { [x: string]: never; }[]);
                            }

                            if (type === "removes") {
                                const { removes } = result.get(op.schemaId);
                                removes.push(...rows as { [x: string]: never; }[]);
                            }

                            executeNext(index + 1);
                        }
                    });
                };

                // Always execute removes first in case we are removing and adding to the same collection
                if (operationGroup.removes) {
                    executeOperation(operationGroup.removes, 'removes');
                } else if (operationGroup.updates) {
                    executeOperation(operationGroup.updates, 'updates');
                } else if (operationGroup.adds) {
                    executeOperation(operationGroup.adds, 'adds');
                } else {
                    // No operations for this group, move to next
                    executeNext(index + 1);
                }
            };

            // Start executing operations
            executeNext(0);
        });
    }

    private _doQueryWork<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: CallbackResult<TShape>,
        shouldClose: boolean = false
    ) {
        const db = new sqlite3.Database(this.fileName);
        const createTableSQL = this.resolveTableCreateStatement(event.operation.schema);
        const { params, sql } = buildFromQueryOperation(event.operation);

        db.all(sql, params || [], (err, rows) => {
            if (err && err.message.includes('no such table')) {
                // Table doesn't exist, create it and retry
                db.run(createTableSQL, (createErr) => {
                    if (createErr) {
                        if (shouldClose) db.close(() => done(Result.error(createErr)));
                        else done(Result.error(createErr));
                        return;
                    }

                    // Retry the SELECT after table creation
                    db.all(sql, params || [], (retryErr, retryRows) => {
                        if (retryErr) {
                            if (shouldClose) db.close(() => done(Result.error(retryErr)));
                            else done(Result.error(retryErr));
                            return;
                        }
                        if (shouldClose) db.close(() => done(Result.success(retryRows as TShape)));
                        else done(Result.success(retryRows as TShape));
                    });
                });
            } else if (err) {
                // Other error
                if (shouldClose) db.close(() => done(Result.error(err)));
                else done(Result.error(err));
            } else {
                // Success
                if (shouldClose) db.close(() => done(Result.success(rows as TShape)));
                else done(Result.success(rows as TShape));
            }
        });
    }
}