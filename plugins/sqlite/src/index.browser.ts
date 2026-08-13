import { wasmDriver } from './drivers/wasm';
import { SqliteDbPluginBase, type SqliteDbPluginOptions } from './plugin';

export type { SqliteConnection, SqliteDriver } from './drivers/types';
export type { SqliteDbPluginOptions } from './plugin';
export type { WasmDriverOptions } from './drivers/wasm';
export { SqliteDbPluginBase } from './plugin';
export { wasmDriver } from './drivers/wasm';

/**
 * SQLite for the browser: WebAssembly, stored in OPFS.
 *
 * This entry point is selected by the `browser` condition in the package manifest, so the same
 * `import { SqliteDbPlugin } from '@routier/sqlite-plugin'` gives a Node application the
 * `node:sqlite` build and a web application this one. Nothing in this file can reach a Node
 * built-in, which is what makes the package bundleable for the web at all.
 *
 * Install `@sqlite.org/sqlite-wasm` — it is an optional peer dependency so that Node
 * applications do not download a WASM binary they will never load.
 *
 * Data persists across reloads. For a database that should not:
 *
 *   new SqliteDbPlugin('app.db', { driver: wasmDriver({ storage: 'memory' }) });
 */
export class SqliteDbPlugin extends SqliteDbPluginBase {
    constructor(databaseName: string, options: SqliteDbPluginOptions = {}) {
        super(databaseName, options.driver ?? wasmDriver());
    }
}
