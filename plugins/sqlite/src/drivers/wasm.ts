import type { SqliteConnection, SqliteDriver } from './types';
import { normalizeParams } from './types';
import { ResultColumn } from '@routier/core/plugins';
import {
    buildTransferPlan,
    isTransferCodecSupported,
    isTransferJsonError,
    rawStorageTransferTypes,
    TransferPlan,
} from '@routier/core/transfer';
import { WorkerChannel } from './wasmChannel';

/**
 * The default browser driver: SQLite compiled to WebAssembly, stored in OPFS.
 *
 * The database lives in a dedicated worker, and this is the main-thread half that talks to it.
 * That split is forced, not stylistic: `FileSystemFileHandle.createSyncAccessHandle` is
 * undefined on the main thread, and every OPFS VFS is built on it, so a main-thread driver
 * cannot persist anything. SQLite's own documentation puts it plainly — only the worker
 * versions can use OPFS. See `wasmWorker.ts`.
 *
 * `@sqlite.org/sqlite-wasm` is an optional peer dependency: a Node application should not
 * download a WASM binary it will never load. Install it in browser projects.
 *
 * ## What a consumer has to do
 *
 * Serve the `.wasm` asset and let the bundler emit the worker. `new Worker(new URL(...),
 * { type: 'module' })` is the form Vite, webpack 5 and Rspack all understand. If your setup
 * needs a different URL, pass `workerUrl`.
 *
 * No COOP or COEP headers are required. That is the reason this uses the `opfs-sahpool` VFS
 * rather than the plain `opfs` one, which needs `SharedArrayBuffer` and therefore
 * cross-origin isolation.
 *
 * ## Durability
 *
 * OPFS is per origin. Data survives reload and navigation. A browser may evict it under
 * storage pressure unless the origin is persisted — `navigator.storage.persist()` asks.
 *
 * ## Concurrency
 *
 * The SAH pool takes exclusive access handles. Two tabs on one origin cannot both hold the
 * same database; the second fails to open rather than corrupting it. Treat the plugin as
 * single-tab unless you coordinate above it.
 */

export type WasmDriverOptions = {
    /**
     * Where the data lives.
     *
     * `opfs` persists across reloads and is the default. `memory` keeps the database in the
     * worker's heap and loses it on navigation — useful for tests and for an application whose
     * server is the source of truth.
     */
    storage?: 'opfs' | 'memory';

    /**
     * Where to load the worker from.
     *
     * Defaults to the worker this package ships, resolved relative to this module. Override it
     * when a bundler cannot rewrite `new URL('./wasmWorker.js', import.meta.url)` — for
     * instance when the library is served from a CDN path the bundler never saw.
     */
    workerUrl?: string | URL;

    /**
     * Whether to encode result rows columnar across the worker boundary. Defaults to `true`.
     *
     * `false` clones them instead, which is what every other driver does and what this one did
     * before the codec existed. Two reasons it is a supported option rather than a private flag:
     * a consumer who suspects the codec of misreporting a value needs a way to check without
     * editing library code, and the two paths must be comparable to each other — identical rows
     * from both is the only claim the codec actually makes.
     *
     * A page whose Content-Security-Policy forbids generated functions takes the clone path
     * regardless; there would be no decoder to run.
     */
    codec?: boolean;
};

/** One worker per page, shared by every database. Spawning one per store would be wasteful. */
let channel: WorkerChannel | null = null;

/**
 * One turn at a time per database, because there is only ONE connection per database.
 *
 * The worker holds a single `WasmDatabase` per name and every `WasmConnection` is a handle to it,
 * so "open a connection per operation" — which is what the plugin does, and what gives every
 * other driver an isolated transaction — hands out N handles to one connection here.
 *
 * That breaks transactions across stores. A save is `BEGIN IMMEDIATE`, several statements, then
 * `COMMIT`, each its own message. Two stores saving at once interleave: the second `BEGIN` lands
 * inside the first's transaction and fails with "cannot start a transaction within a
 * transaction", and worse, statements from one save land inside the other's transaction and are
 * committed or rolled back with it. Under a concurrent workload that is silent lost updates.
 *
 * A page cannot hit this with one store, which is why it survived a full test suite: `node:sqlite`
 * opens a real connection per operation and is genuinely isolated, so only the browser driver has
 * the problem and only when two stores write at once.
 *
 * Keyed by database name and held in module scope, NOT on the driver: `wasmDriver()` is called
 * once per store, so a per-driver queue would put two queues over one connection and serialise
 * nothing. Different databases are different connections in the worker and do not wait on
 * each other.
 */
const turns = new Map<string, Promise<unknown>>();

/**
 * Waits for the previous holder of this database to finish, and answers the release for this one.
 *
 * A chained promise rather than a lock: the next caller starts when the previous one settles,
 * whichever way it went, so one failure cannot stall the rest.
 */
const takeTurn = async (databaseName: string): Promise<() => void> => {
    let release!: () => void;

    const held = new Promise<void>(resolve => { release = resolve; });
    const ourTurn = (turns.get(databaseName) ?? Promise.resolve())
        .then((): void => undefined, (): void => undefined);

    turns.set(databaseName, ourTurn.then(() => held));

    await ourTurn;

    return release;
};

const resolveChannel = (workerUrl?: string | URL): WorkerChannel => {
    if (channel != null) {
        return channel;
    }

    // Both branches spelled out on purpose, and HERE rather than inside the channel. A bundler
    // detects a worker by matching `new Worker(new URL('...', import.meta.url))` as one literal
    // expression at the call site; hand it a variable and it emits nothing, which is what happened
    // here first — the build succeeded and the worker 404'd at runtime.
    const worker = workerUrl == null
        ? new Worker(new URL('./wasmWorker.js', import.meta.url), { type: 'module' })
        : new Worker(workerUrl, { type: 'module' });

    channel = new WorkerChannel(worker);

    return channel;
};

class WasmConnection implements SqliteConnection {

    constructor(
        private readonly channel: WorkerChannel,
        private readonly databaseName: string,
        private readonly codec: boolean,
        private readonly release: () => void
    ) { }

    /**
     * Encodes the rows columnar when it can, and clones them when it cannot.
     *
     * This is the ONE driver that acts on the result description, because it is the one that pays
     * to move rows across a boundary. The mapping is chosen here, not by the statement builder:
     * sqlite-wasm hands back the raw stored shapes — ISO text for a date, 0 or 1 for a boolean —
     * and only this driver knows that.
     */
    async all(sql: string, params?: readonly unknown[], result?: readonly ResultColumn[]): Promise<unknown[]> {
        const bound = normalizeParams(params);
        const plan = this.planFor(result);

        if (plan == null) {
            return this.channel.send({ kind: 'all', databaseName: this.databaseName, sql, params: bound });
        }

        try {
            return await this.channel.send({ kind: 'all', databaseName: this.databaseName, sql, params: bound, plan });
        } catch (error) {
            if (isTransferJsonError(error) === false) {
                throw error;
            }

            // A JSON column holding text that is not JSON poisoned the chunk's joined document.
            // The worker cannot notice without a second parse, which is the cost the joining
            // exists to avoid, so the correctness backstop is here: run it again with no plan and
            // take the clone path, which parses row by row and tolerates it. Costs one retry, and
            // only for data that is already broken.
            return await this.channel.send({ kind: 'all', databaseName: this.databaseName, sql, params: bound });
        }
    }

    /**
     * The plan for a described result, or `undefined` to clone.
     *
     * `undefined` for three reasons, all of them meaning "take the path that always works": the
     * statement described nothing, the description cannot round-trip through a chunk, or this page
     * forbids generated functions so there would be no decoder on the other side.
     */
    private planFor(result?: readonly ResultColumn[]): TransferPlan | undefined {
        if (result == null || this.codec === false || isTransferCodecSupported() === false) {
            return undefined;
        }

        return buildTransferPlan(result, rawStorageTransferTypes);
    }

    async run(sql: string, params?: readonly unknown[]): Promise<void> {
        await this.channel.send({
            kind: 'run', databaseName: this.databaseName, sql, params: normalizeParams(params),
        });
    }

    /**
     * Hands the database to whoever is waiting. The worker keeps it OPEN; see `wasmWorker.ts`.
     *
     * Not a no-op any more. The plugin closes on every path, and that is the signal that this
     * caller's transaction is over — without it the next store would start its `BEGIN` inside
     * this one's. Closing the database itself would still be wrong: it only exists while open,
     * and releasing the storage happens in `deleteDatabase`.
     */
    async close(): Promise<void> {
        this.release();
    }
}

export const wasmDriver = (options: WasmDriverOptions = {}): SqliteDriver => {
    const storage = options.storage ?? 'opfs';
    const codec = options.codec ?? true;

    return {
        name: `sqlite-wasm (${storage})`,
        foldsUnicodeCasing: false,

        async open(databaseName: string): Promise<SqliteConnection> {
            const active = resolveChannel(options.workerUrl);

            // Opening twice is harmless: the worker keeps one database per name.
            await active.send({ kind: 'open', databaseName, storage });

            // AFTER the open, so a first caller does not hold the turn across the WASM boot.
            const release = await takeTurn(databaseName);

            return new WasmConnection(active, databaseName, codec, release);
        },

        async deleteDatabase(databaseName: string): Promise<void> {
            const active = resolveChannel(options.workerUrl);

            await active.send({ kind: 'delete', databaseName, storage });
        },
    };
};
