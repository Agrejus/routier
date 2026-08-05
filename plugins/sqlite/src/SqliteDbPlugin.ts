import sqlite3 from 'sqlite3';
import { decodeJsonColumns } from '@routier/sql-plugin-core';
import { OptimisticConcurrencyError } from '@routier/core';
import fs from 'fs';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToSqliteTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, SqlTranslator } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { SqlPersistOperation } from './types';

export class SqliteDbPlugin implements IDbPlugin {

    private fileName: string;

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

    constructor(fileName: string) {
        this.fileName = fileName;
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        this.resolveTableCreateStatement(schema);
    }

    /**
     * Opens the database file, routing an open failure to `onOpenError`.
     *
     * The callback is not optional in practice. Without one, `sqlite3` reports a failed open
     * by emitting `error` on the Database object — which, with no listener attached, Node
     * throws as an uncaught exception — and none of the statement callbacks queued against
     * that handle ever fire. An unopenable file (a directory in the file's place, a
     * permissions failure, a missing parent) therefore crashed the process *and* left the
     * save or query hanging forever. With the callback, the failure arrives as a rejected
     * operation like any other.
     */
    private openDatabase(onOpenError: (error: Error) => void): sqlite3.Database {
        return new sqlite3.Database(this.fileName, (openError) => {
            if (openError) {
                onOpenError(openError);
            }
        });
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
        } catch  {
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
        const cached = this.tableCache.get(collectionName);

        if (cached != null) {
            return cached;
        }

        const createTableSQL = compiledSchemaToSqliteTable(schema);

        this.tableCache.set(collectionName, createTableSQL);

        return createTableSQL;
    }

    private _doPersistWork(
        event: DbPluginBulkPersistEvent,
        done: CallbackResult<BulkPersistResult>
    ): void {

        // Guarded so a failed open and a failed statement cannot both report.
        let settled = false;
        const settle = (result: ReturnType<typeof Result.success<BulkPersistResult>> | ReturnType<typeof Result.error>) => {
            if (settled) {
                return;
            }
            settled = true;
            done(result as never);
        };

        const db = this.openDatabase((openError) => settle(Result.error(openError)));
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

        db.serialize(() => {
            // Execute all operations sequentially
            const executeNext = (index: number) => {
                if (index >= operations.length) {
                    // All operations completed, commit
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            db.run('ROLLBACK', () => {
                                db.close(() => settle(Result.error(commitErr)));
                            });
                            return;
                        }
                        db.close(() => settle(Result.success(result)));
                    });
                    return;
                }

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

                // Execute one operation
                // A token-checked UPDATE that matched no row lost the race: another writer
                // changed the row after this one read it. Roll everything back and name it.
                const conflictOn = (op: SqlPersistOperation, rows: unknown[]) => {
                    if (op.conflictCheck == null || rows.length > 0) {
                        return false;
                    }

                    db.run('ROLLBACK', () => {
                        db.close(() => settle(Result.error(
                            new OptimisticConcurrencyError(event.schemas.get(op.schemaId).collectionName, [op.conflictCheck!.id as never])
                        )));
                    });

                    return true;
                };

                const executeOperation = (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes') => {
                    db.all(op.sql, op.params || [], (err, rows) => {
                        if (err && err.message.includes('no such table')) {
                            // Table doesn't exist, create it and retry
                            db.run(op.createTableSql, (createErr) => {
                                if (createErr) {
                                    db.run('ROLLBACK', () => {
                                        db.close(() => settle(Result.error(createErr)));
                                    });
                                    return;
                                }

                                // Retry the operation after table creation
                                db.all(op.sql, op.params || [], (retryErr, retryRows) => {
                                    if (retryErr) {
                                        db.run('ROLLBACK', () => {
                                            db.close(() => settle(Result.error(retryErr)));
                                        });
                                        return;
                                    }

                                    if (conflictOn(op, retryRows)) {
                                        return;
                                    }

                                    collect(op, type, retryRows);

                                    executeNext(index + 1);
                                });
                            });
                        } else if (err) {
                            // Other error, rollback
                            db.run('ROLLBACK', () => {
                                db.close(() => settle(Result.error(err)));
                            });
                        } else {
                            if (conflictOn(op, rows)) {
                                return;
                            }

                            // Success, continue to next operation
                            collect(op, type, rows);

                            executeNext(index + 1);
                        }
                    });
                };

                executeOperation(operations[index].op, operations[index].type);
            };

            // BEGIN IMMEDIATE takes the RESERVED lock up front, so it is the statement that
            // fails with SQLITE_BUSY when another writer holds the file. That error used to
            // be discarded — the callback was omitted entirely — and execution fell straight
            // through to the operations below, which then ran with no transaction at all: a
            // mid-batch failure left the earlier writes committed and the ROLLBACK had
            // nothing to undo. Matches the COMMIT handling above.
            db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
                if (beginErr) {
                    db.close(() => settle(Result.error(beginErr)));
                    return;
                }

                executeNext(0);
            });
        });
    }

    /**
     * One connection per query, closed on EVERY completion path.
     *
     * This used to take a `shouldClose` parameter defaulting to false that no caller ever
     * passed, so the `sqlite3.Database` opened below was never closed — one leaked file
     * handle per query for the life of the process. The persist path already opens and
     * closes per event; this makes query symmetric with it.
     *
     * Deliberately NOT a long-lived shared connection: per-operation connections are what
     * let SQLite's own file locking serialize concurrent writers, and a shared handle would
     * make disposal a lifecycle problem for every caller.
     */
    private _doQueryWork<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: CallbackResult<TShape>
    ) {
        const createTableSQL = this.resolveTableCreateStatement(event.operation.schema);
        const { params, sql } = buildFromQueryOperation(event.operation);

        // A failed open and a failed statement can both report, so `done` is guarded to run
        // exactly once (known-defects #3's "calls done exactly once").
        let settled = false;

        // Every exit goes through here, so a path added later cannot forget to close.
        const finish = (result: ReturnType<typeof Result.success<TShape>> | ReturnType<typeof Result.error>) => {
            if (settled) {
                return;
            }
            settled = true;
            db.close(() => done(result as never));
        };

        const db = this.openDatabase((openError) => {
            if (settled) {
                return;
            }
            settled = true;
            // No close: the handle never opened.
            done(Result.error(openError));
        });

        db.all(sql, params || [], (err, rows) => {
            if (err && err.message.includes('no such table')) {
                // Table doesn't exist, create it and retry
                db.run(createTableSQL, (createErr) => {
                    if (createErr) {
                        finish(Result.error(createErr));
                        return;
                    }

                    // Retry the SELECT after table creation
                    db.all(sql, params || [], (retryErr, retryRows) => {
                        if (retryErr) {
                            finish(Result.error(retryErr));
                            return;
                        }

                        finish(Result.success(retryRows as TShape));
                    });
                });
            } else if (err) {
                // Other error
                finish(Result.error(err));
            } else {
                // Success
                finish(Result.success(rows as TShape));
            }
        });
    }
}