import { normalizeParams, type SqliteConnection, type SqliteDriver } from './types';

/**
 * The default Node driver, built on `node:sqlite`.
 *
 * `node:sqlite` ships with Node, so this plugin no longer needs a native build. `sqlite3`
 * compiles through node-gyp on install, which fails on any machine without a toolchain and is
 * the reason this was the one package the consumer check could not cover. Nothing to compile
 * means nothing to fail.
 *
 * Requires Node 22.5 or later. On Node 18 and 20, or to keep the old engine, pass
 * `sqlite3Driver()` from `@routier/sqlite-plugin/drivers/sqlite3`.
 *
 * The API is synchronous. The promises here are already-resolved wrappers, not deferred work:
 * the interface is async because a WASM engine cannot be synchronous, not because this one is.
 */

/** The parts of `node:sqlite` this uses, so the import can be typed without the module. */
type DatabaseSyncLike = {
    prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
    exec(sql: string): void;
    close(): void;
};

type NodeSqliteModule = {
    DatabaseSync: new (path: string) => DatabaseSyncLike;
};

const loadModule = async (): Promise<NodeSqliteModule> => {
    try {
        return await import('node:sqlite') as unknown as NodeSqliteModule;
    } catch (error) {
        throw new Error(
            'node:sqlite is not available. It requires Node 22.5 or later. On an older Node, ' +
            'use the sqlite3 driver: `new SqliteDbPlugin(name, { driver: sqlite3Driver() })` ' +
            `from '@routier/sqlite-plugin/drivers/sqlite3'. Original error: ${(error as Error).message}`
        );
    }
};

class NodeSqliteConnection implements SqliteConnection {

    constructor(private readonly database: DatabaseSyncLike) { }

    async all(sql: string, params?: readonly unknown[]): Promise<unknown[]> {
        return this.database.prepare(sql).all(...normalizeParams(params));
    }

    async run(sql: string, params?: readonly unknown[]): Promise<void> {
        // `exec` is the only way to run a statement with no parameters that may not be a
        // single statement — transaction control and DDL both arrive here.
        if (params == null || params.length === 0) {
            this.database.exec(sql);
            return;
        }

        this.database.prepare(sql).run(...normalizeParams(params));
    }

    async close(): Promise<void> {
        this.database.close();
    }
}

export const nodeSqliteDriver = (): SqliteDriver => ({
    name: 'node:sqlite',

    async open(databaseName: string): Promise<SqliteConnection> {
        const { DatabaseSync } = await loadModule();

        // A constructor that throws — an unopenable path, a directory where the file should
        // be — becomes a rejected promise, never an uncaught exception. See #34.
        return new NodeSqliteConnection(new DatabaseSync(databaseName));
    },

    async deleteDatabase(databaseName: string): Promise<void> {
        if (databaseName === ':memory:') {
            return;
        }

        const { unlink } = await import('node:fs/promises');

        try {
            await unlink(databaseName);
        } catch (error) {
            // Already gone is the desired state, not a failure.
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    },
});
