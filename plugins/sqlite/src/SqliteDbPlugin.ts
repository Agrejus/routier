import sqlite3 from 'sqlite3';
import fs from 'fs';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToSqliteTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { WorkPipeline } from '@routier/core';

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

        const select = buildFromQueryOperation(event.operation);

        this._doWork<TShape>(event.operation.schema, select.sql, select.params, (result) => {
            if (result.ok === "error") {
                done(PluginEventResult.error(event.id, result.error));
                return;
            }

            done(PluginEventResult.success(event.id, result.data));
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

        const pipeline = new WorkPipeline();
        const persisted = event.operation.toResult();

        for (const [schemaId, changes] of event.operation) {

            if (changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            pipeline.pipe((done) => {
                debugger;
                const persist = buildFromPersistOperation(schema, changes);

                this._doWork(schema, persist.sql, persist.params, (result) => {
                    if (result.ok === "error") {
                        done(Result.error(result.error));
                        return;
                    }
                    debugger;
                    done(Result.success());
                });
            });
        }

        pipeline.filter(result => {
            if (result.ok === "error") {
                return done(PluginEventResult.error(event.id, result.error));
            }

            // need to pass back the real result
            done(PluginEventResult.success(event.id, persisted));
        })
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

    private _doWork<TResult>(
        schema: CompiledSchema<unknown>,
        workSql: string,
        params: any[] | undefined,
        done: CallbackResult<TResult>,
        shouldClose: boolean = false
    ) {
        const db = new sqlite3.Database(this.fileName);
        const createTableSQL = this.resolveTableCreateStatement(schema);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Need to do bulk operations and then commit them vs doing one at a time

            if (/^\s*select/i.test(workSql)) {
                // Try SELECT first, create table only if needed
                db.all(workSql, params || [], (err, rows) => {
                    if (err && err.message.includes('no such table')) {
                        // Table doesn't exist, create it and retry
                        db.run(createTableSQL, createErr => {
                            if (createErr) {
                                db.run('ROLLBACK', () => {
                                    if (shouldClose) db.close(() => done(Result.error(createErr)));
                                    else done(Result.error(createErr));
                                });
                                return;
                            }

                            // Retry the SELECT after table creation
                            db.all(workSql, params || [], (retryErr, retryRows) => {
                                if (retryErr) {
                                    db.run('ROLLBACK', () => {
                                        if (shouldClose) db.close(() => done(Result.error(retryErr)));
                                        else done(Result.error(retryErr));
                                    });
                                    return;
                                }
                                db.run('COMMIT', commitErr => {
                                    if (commitErr) {
                                        if (shouldClose) db.close(() => done(Result.error(commitErr)));
                                        else done(Result.error(commitErr));
                                        return;
                                    }
                                    if (shouldClose) db.close(() => done(Result.success(retryRows as TResult)));
                                    else done(Result.success(retryRows as TResult));
                                });
                            });
                        });
                    } else if (err) {
                        // Other error, rollback
                        db.run('ROLLBACK', () => {
                            if (shouldClose) db.close(() => done(Result.error(err)));
                            else done(Result.error(err));
                        });
                    } else {
                        // Success, commit
                        db.run('COMMIT', commitErr => {
                            if (commitErr) {
                                if (shouldClose) db.close(() => done(Result.error(commitErr)));
                                else done(Result.error(commitErr));
                                return;
                            }
                            if (shouldClose) db.close(() => done(Result.success(rows as TResult)));
                            else done(Result.success(rows as TResult));
                        });
                    }
                });
                return;
            }

            // Try work SQL first, create table only if needed
            // Use db.all for operations with RETURNING clause to get actual data
            db.all(workSql, params || [], (err, rows) => {
                if (err && err.message.includes('no such table')) {
                    // Table doesn't exist, create it and retry
                    db.run(createTableSQL, createErr => {
                        if (createErr) {
                            db.run('ROLLBACK', () => {
                                if (shouldClose) db.close(() => done(Result.error(createErr)));
                                else done(Result.error(createErr));
                            });
                            return;
                        }

                        // Retry the work SQL after table creation
                        db.all(workSql, params || [], (retryErr, retryRows) => {
                            if (retryErr) {
                                db.run('ROLLBACK', () => {
                                    if (shouldClose) db.close(() => done(Result.error(retryErr)));
                                    else done(Result.error(retryErr));
                                });
                                return;
                            }

                            db.run('COMMIT', commitErr => {
                                if (commitErr) {
                                    if (shouldClose) db.close(() => done(Result.error(commitErr)));
                                    else done(Result.error(commitErr));
                                    return;
                                }
                                if (shouldClose) db.close(() => done(Result.success(retryRows as TResult)));
                                else done(Result.success(retryRows as TResult));
                            });
                        });
                    });
                } else if (err) {
                    // Other error, rollback
                    db.run('ROLLBACK', () => {
                        if (shouldClose) db.close(() => done(Result.error(err)));
                        else done(Result.error(err));
                    });
                } else {
                    // Success, commit
                    db.run('COMMIT', commitErr => {
                        if (commitErr) {
                            if (shouldClose) db.close(() => done(Result.error(commitErr)));
                            else done(Result.error(commitErr));
                            return;
                        }
                        if (shouldClose) db.close(() => done(Result.success(rows as TResult)));
                        else done(Result.success(rows as TResult));
                    });
                }
            });
        });
    }
}