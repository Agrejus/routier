import { PGliteWorker } from '@electric-sql/pglite/worker';
import { PostgresDbPluginBase } from '@routier/postgres-plugin-core';
import { pgliteDriver, PGliteLike } from './drivers/pglite';

export type { PGliteLike, PGliteDriverOptions } from './drivers/pglite';
export { pgliteDriver } from './drivers/pglite';
export { pgliteDbPlugin } from './shared';

export type PGliteDbPluginOptions = {
    /**
     * Where to load the worker from.
     *
     * Defaults to the worker this package ships, resolved relative to this module. Override it
     * to supply your own — which is how you add pgvector, or any other extension, since
     * extensions are constructed inside the worker and cannot be sent across `postMessage`.
     */
    workerUrl?: string | URL;
};

/**
 * PostgreSQL in the browser: WebAssembly, persisted to OPFS.
 *
 * `databaseName` is PGlite's data directory, and its prefix chooses the storage:
 *
 *   new PGliteDbPlugin('opfs-ahp://app')   // the default when no prefix is given
 *   new PGliteDbPlugin('idb://app')        // IndexedDB — slower, but works in Safari
 *   new PGliteDbPlugin('memory://app')     // lost on navigation
 *
 * A bare name becomes `opfs-ahp://`, which is the storage worth defaulting to. There is no
 * separate `storage` option, because the prefix already says it.
 *
 * This entry point is selected by the `browser` condition in the package manifest, so the same
 * `import { PGliteDbPlugin } from '@routier/pglite-plugin'` gives Node the in-process build and
 * a web application this one. Nothing here can reach a Node built-in.
 *
 * ## What a consumer has to do
 *
 * Install `@electric-sql/pglite`, serve its `.wasm` and `.data` assets, and let the bundler
 * emit the worker. `new Worker(new URL(...), { type: 'module' })` is the form Vite, webpack 5
 * and Rspack all understand. Pass `workerUrl` if your setup needs a different URL.
 *
 * No COOP or COEP headers are required.
 *
 * ## Durability
 *
 * OPFS is per origin, and survives reload and navigation. A browser may evict it under storage
 * pressure unless the origin is persisted — `navigator.storage.persist()` asks.
 *
 * ## Concurrency
 *
 * Multi-tab safe. One tab is elected leader and owns the database; the rest proxy to it, and
 * another election runs when the leader closes.
 *
 * ## Safari
 *
 * `opfs-ahp` does NOT work in Safari, which caps synchronous access handles at 252 while a
 * PostgreSQL installation needs over 300 files. Use `idb://` there.
 */
export class PGliteDbPlugin extends PostgresDbPluginBase {
    constructor(databaseName: string, options: PGliteDbPluginOptions = {}) {
        const dataDir = databaseName.includes('://') ? databaseName : `opfs-ahp://${databaseName}`;

        super(pgliteDriver(dataDir, createWorkerDatabase(dataDir, options.workerUrl), {
            name: 'pglite (worker)',
        }));
    }
}

const createWorkerDatabase = (dataDir: string, workerUrl?: string | URL): Promise<PGliteLike> => {
    // Both branches spelled out on purpose. A bundler detects a worker by matching
    // `new Worker(new URL('...', import.meta.url))` as one literal expression at the call site;
    // hand it a variable and it emits nothing, so the build succeeds and the worker 404s.
    const instance = workerUrl == null
        ? new Worker(new URL('./pgliteWorker.js', import.meta.url), { type: 'module' })
        : new Worker(workerUrl, { type: 'module' });

    return PGliteWorker.create(instance, { dataDir }) as unknown as Promise<PGliteLike>;
};
