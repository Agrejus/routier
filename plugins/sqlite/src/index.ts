import { nodeSqliteDriver } from './drivers/nodeSqlite';
import { SqliteDbPluginBase, type SqliteDbPluginOptions } from './plugin';

export type { SqliteConnection, SqliteDriver } from './drivers/types';
export type { SqliteDbPluginOptions } from './plugin';
export { SqliteDbPluginBase } from './plugin';
export { nodeSqliteDriver } from './drivers/nodeSqlite';

/**
 * SQLite for Node, on `node:sqlite`.
 *
 * This entry point is selected by the `node` condition in the package manifest. A browser
 * bundler resolves the `browser` condition instead and gets the WASM build, so neither
 * environment ever loads the other's engine.
 *
 * Needs Node 22.5 or later. On Node 18 or 20, pass the sqlite3 driver:
 *
 *   import { sqlite3Driver } from '@routier/sqlite-plugin/drivers/sqlite3';
 *   new SqliteDbPlugin('app.db', { driver: sqlite3Driver() });
 */
export class SqliteDbPlugin extends SqliteDbPluginBase {
    constructor(databaseName: string, options: SqliteDbPluginOptions = {}) {
        super(databaseName, options.driver ?? nodeSqliteDriver());
    }
}
