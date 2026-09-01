import { PGliteWorker } from '@electric-sql/pglite/worker';
import { PostgresDbPluginBase } from '@routier/postgres-plugin-core';
import { pgliteDriver, PGliteLike } from './drivers/pglite';
import type { PostgresDriver } from '@routier/postgres-plugin-core';
import { deleteDataDir, resolveDataDir } from './browserStorage';
import { codedReadChannel, type CodedReadChannel } from './codedReadChannel';

export type { PGliteLike, PGliteDriverOptions } from './drivers/pglite';
export { pgliteDriver } from './drivers/pglite';
export { pgliteDbPlugin } from './shared';

export type PGliteDbPluginOptions = {
    /**
     * Whether reads may use routier's coded channel to the worker. Defaults to `true`.
     *
     * `false` sends every read through PGlite's own proxy, which is what a follower tab does
     * anyway. Two reasons it is an option rather than a private flag: a consumer who suspects the
     * codec of misreporting a value needs a way to check without editing library code, and the two
     * paths must be comparable — identical entities from both is the only claim being made.
     *
     * Part of a data directory's identity, like `workerUrl`: one engine serves a directory, so two
     * stores over it cannot disagree about this.
     */
    codec?: boolean;

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
 *   new PGliteDbPlugin('opfs-ahp://app')   // OPFS
 *   new PGliteDbPlugin('idb://app')        // IndexedDB — slower, and what WebKit gets
 *   new PGliteDbPlugin('memory://app')     // lost on navigation
 *
 * A bare name becomes the fastest storage that persists on the current browser: `opfs-ahp://`,
 * or `idb://` on WebKit, which cannot hold a PostgreSQL installation in OPFS. There is no
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
 * Handled: a bare name resolves to `idb://` on WebKit. `opfs-ahp` cannot open there, because
 * WebKit caps synchronous access handles at 252 and a PostgreSQL installation needs over 300
 * files. Naming `opfs-ahp://` outright on WebKit still fails, as it must.
 *
 * ## Destroying
 *
 * `destroy` closes the database and deletes it, like every other embedded plugin here. It does
 * not behave like `@routier/postgresql-plugin`, which disconnects from a server it does not own.
 *
 * Stores over one directory share an engine, so a destroy takes the data from all of them. The
 * others carry on against a fresh empty database rather than a closed one.
 */
export class PGliteDbPlugin extends PostgresDbPluginBase {
    constructor(databaseName: string, options: PGliteDbPluginOptions = {}) {
        super(resolveDriver(
            resolveDataDir(databaseName, navigator.userAgent),
            options.workerUrl,
            options.codec ?? true
        ));
    }
}

/**
 * One driver per data directory, shared by every store over it.
 *
 * A worker is bound to the directory it was created with — PGlite builds the database inside
 * it — so this cannot be one worker per page the way `@routier/sqlite-plugin` manages it. Per
 * directory is the useful ceiling anyway: it is what a component rebuilding its store on every
 * mount would otherwise pay, one worker and one PostgreSQL boot at a time.
 *
 * The driver is cached rather than the worker, and that part is not an optimisation. PGlite is
 * one connection and the driver serialises access to it in its own closure, so two drivers over
 * one instance would each believe they had it to themselves — and one store's `BEGIN` would land
 * inside another's transaction.
 *
 * Entries are never evicted, which is what makes sharing safe. `destroy` closes the engine,
 * deletes the directory and leaves the entry cold; a store that shares it and was not itself
 * destroyed starts a fresh engine on its next operation and finds the data gone — the same thing
 * a surviving `@routier/sqlite-plugin` or `@routier/dexie-plugin` store sees. Reference counting
 * cannot work here: nothing but `destroy` reaches a plugin, so a store built and abandoned —
 * which is the ordinary case — would hold a count that never comes back down.
 */
type Registered = { driver: PostgresDriver; workerUrl: string; codec: boolean };

const drivers = new Map<string, Registered>();

const resolveDriver = (dataDir: string, workerUrl?: string | URL, codec = true): PostgresDriver => {
    const requested = String(workerUrl ?? '');
    const registered = drivers.get(dataDir);

    if (registered != null) {
        if (registered.codec !== codec) {
            throw new Error(
                `'${dataDir}' is already open with codec ${registered.codec}. One engine serves a data ` +
                `directory, so the second setting would be ignored; open a different directory instead.`
            );
        }

        // Keyed on the directory alone, on purpose. Keying on the worker too would put two
        // drivers over one PGlite instance, and two queues over one connection is how a store's
        // BEGIN ends up inside another's transaction.
        if (registered.workerUrl !== requested) {
            throw new Error(
                `'${dataDir}' is already open with a different workerUrl. One engine serves a data directory, ` +
                `so the second worker would be ignored; open a different directory instead.`
            );
        }

        return registered.driver;
    }

    // Started per driver start, so a restarted engine gets a channel to its new worker.
    let channel: CodedReadChannel | null = null;

    const driver = pgliteDriver(dataDir, () => {
        const started = startWorker(dataDir, workerUrl);

        channel = started.codedReads;

        return started.database;
    }, {
        name: 'pglite (worker)',
        codedReads: codec ? () => channel ?? undefined : undefined,
        deleteStorage: () => deleteDataDir(dataDir),
    });

    drivers.set(dataDir, { driver, workerUrl: requested, codec });

    return driver;
};

/**
 * The worker, and routier's channel to it.
 *
 * The channel is attached to the SAME worker PGlite proxies through, on its `postMessage` — which
 * PGlite leaves free once start-up is done, because its own RPC moves to a `BroadcastChannel`. See
 * `codedReads.ts`.
 */
const startWorker = (dataDir: string, workerUrl?: string | URL): { database: Promise<PGliteLike>; codedReads: CodedReadChannel } => {
    // Both branches spelled out on purpose. A bundler detects a worker by matching
    // `new Worker(new URL('...', import.meta.url))` as one literal expression at the call site;
    // hand it a variable and it emits nothing, so the build succeeds and the worker 404s.
    const instance = workerUrl == null
        ? new Worker(new URL('./pgliteWorker.js', import.meta.url), { type: 'module' })
        : new Worker(workerUrl, { type: 'module' });

    return {
        database: PGliteWorker.create(instance, { dataDir }) as unknown as Promise<PGliteLike>,
        codedReads: codedReadChannel(instance),
    };
};
