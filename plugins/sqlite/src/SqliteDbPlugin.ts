import sqlite3 from 'sqlite3';
import { buildSelectFromExpression, compiledSchemaToSqliteTable } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';

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
        // this.resolveSchema(event.operation.schema);
        // const select = buildSelectFromExpression<TRoot>({
        //     schema: event.schema,
        //     expression: event.operation.expression
        // });

        // this._doWork(event.schema.collectionName, select.sql, select.params, (result, error) => {

        // })
    }

    destroy(_event: DbPluginEvent, done: (error?: any) => void): void {
        const db = new sqlite3.Database(':memory:');
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>) {

    }

    private _doWork<TResult>(
        collectionName: string,
        workSql: string,
        params: any[] | undefined,
        done: (result: TResult, error?: any) => void,
        shouldClose: boolean = false
    ) {
        const db = new sqlite3.Database(this.fileName);
        const createTableSQL = tableCache[collectionName];
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run(createTableSQL, err => {
                if (err) {
                    db.run('ROLLBACK', () => {
                        if (shouldClose) db.close(() => done(undefined as any, err));
                        else done(undefined as any, err);
                    });
                    return;
                }
                // Decide if this is a SELECT or not
                if (/^\s*select/i.test(workSql)) {
                    db.all(workSql, params || [], (err, rows) => {
                        if (err) {
                            db.run('ROLLBACK', () => {
                                if (shouldClose) db.close(() => done(undefined as any, err));
                                else done(undefined as any, err);
                            });
                            return;
                        }
                        db.run('COMMIT', commitErr => {
                            if (shouldClose) db.close(() => done(rows as any, commitErr));
                            else done(rows as any, commitErr);
                        });
                    });

                    return;
                }

                db.run(workSql, params || [], function (err) {
                    if (err) {
                        db.run('ROLLBACK', () => {
                            if (shouldClose) db.close(() => done(undefined as any, err));
                            else done(undefined as any, err);
                        });
                        return;
                    }
                    db.run('COMMIT', commitErr => {
                        if (shouldClose) db.close(() => done(this as any, commitErr));
                        else done(this as any, commitErr);
                    });
                });
            });
        });
    }
}