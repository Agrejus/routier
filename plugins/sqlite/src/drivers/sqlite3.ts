import { normalizeParams, type SqliteConnection, type SqliteDriver } from './types';

/**
 * The `sqlite3` driver, kept for Node 18 and 20 and for anyone already on this engine.
 *
 * `sqlite3` is an optional peer dependency: install it yourself if you use this driver. It
 * builds a native binding through node-gyp, which is exactly the install failure the default
 * `node:sqlite` driver exists to avoid.
 *
 *   import { SqliteDbPlugin } from '@routier/sqlite-plugin';
 *   import { sqlite3Driver } from '@routier/sqlite-plugin/drivers/sqlite3';
 *
 *   new SqliteDbPlugin('app.db', { driver: sqlite3Driver() });
 */

type Sqlite3Database = {
    all(sql: string, params: unknown[], callback: (error: Error | null, rows: unknown[]) => void): void;
    run(sql: string, params: unknown[], callback: (error: Error | null) => void): void;
    close(callback: (error: Error | null) => void): void;
};

type Sqlite3Module = {
    Database: new (path: string, callback: (error: Error | null) => void) => Sqlite3Database;
};

const loadModule = async (): Promise<Sqlite3Module> => {
    try {
        const loaded = await import('sqlite3') as unknown as { default?: Sqlite3Module } & Sqlite3Module;

        return loaded.default ?? loaded;
    } catch (error) {
        throw new Error(
            "sqlite3 is not installed. It is an optional peer dependency of " +
            "@routier/sqlite-plugin; run `npm install sqlite3`, or use the default driver, " +
            `which needs no native build. Original error: ${(error as Error).message}`
        );
    }
};

class Sqlite3Connection implements SqliteConnection {

    constructor(private readonly database: Sqlite3Database) { }

    all(sql: string, params?: readonly unknown[]): Promise<unknown[]> {
        return new Promise((resolve, reject) => {
            this.database.all(sql, normalizeParams(params), (error, rows) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(rows);
            });
        });
    }

    run(sql: string, params?: readonly unknown[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.database.run(sql, normalizeParams(params), (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    close(): Promise<void> {
        return new Promise((resolve) => {
            // A close failure is not actionable and must not mask the operation's own result,
            // so it resolves either way.
            this.database.close(() => resolve());
        });
    }
}

export const sqlite3Driver = (): SqliteDriver => ({
    name: 'sqlite3',

    async open(databaseName: string): Promise<SqliteConnection> {
        const { Database } = await loadModule();

        return new Promise((resolve, reject) => {
            /**
             * The callback is not optional in practice. Without one, `sqlite3` reports a failed
             * open by emitting `error` on the Database object — which, with no listener
             * attached, Node throws as an uncaught exception — and none of the statement
             * callbacks queued against that handle ever fire. An unopenable file therefore
             * crashed the process *and* left the operation hanging forever. See #34.
             */
            const database = new Database(databaseName, (openError) => {
                if (openError) {
                    reject(openError);
                    return;
                }

                resolve(new Sqlite3Connection(database));
            });
        });
    },

    async deleteDatabase(databaseName: string): Promise<void> {
        if (databaseName === ':memory:') {
            return;
        }

        const { unlink } = await import('node:fs/promises');

        try {
            await unlink(databaseName);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    },
});
