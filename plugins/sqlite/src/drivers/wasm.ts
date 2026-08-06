import type { SqliteConnection, SqliteDriver } from './types';
import { normalizeParams } from './types';
import type { WorkerRequest, WorkerResponse } from './wasmWorker';

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
};

/**
 * `Omit` over a union collapses it to the properties every member shares, which here is only
 * `kind` and `databaseName`. Distributing keeps each request shape intact.
 */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/** A request awaiting its response, by id. */
type Pending = { resolve: (rows: unknown[]) => void; reject: (error: Error) => void };

class WorkerChannel {

    private readonly pending = new Map<number, Pending>();
    private nextId = 0;
    private worker: Worker;

    constructor(workerUrl?: string | URL) {
        // Both branches spelled out on purpose. A bundler detects a worker by matching
        // `new Worker(new URL('...', import.meta.url))` as one literal expression at the call
        // site; hand it a variable and it emits nothing, which is what happened here first —
        // the build succeeded and the worker 404'd at runtime.
        this.worker = workerUrl == null
            ? new Worker(new URL('./wasmWorker.js', import.meta.url), { type: 'module' })
            : new Worker(workerUrl, { type: 'module' });

        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const response = event.data;
            const waiting = this.pending.get(response.id);

            if (waiting == null) {
                return;
            }

            this.pending.delete(response.id);

            if (response.ok === false) {
                // Rebuilt as a real Error on this side. The plugin classifies a missing table
                // by reading `message`, so the text has to survive the trip intact.
                waiting.reject(new Error(response.error));
                return;
            }

            waiting.resolve(response.rows ?? []);
        };

        this.worker.onerror = (event) => {
            // A worker that fails to load never answers, so every in-flight request would hang
            // forever. Fail them all with something that names the cause.
            const error = new Error(
                `The SQLite worker failed to load (${event.message ?? 'no message'}). ` +
                'Check that your bundler emitted it and that the .wasm asset is served.'
            );

            for (const [, waiting] of this.pending) {
                waiting.reject(error);
            }

            this.pending.clear();
        };
    }

    send(request: WithoutId<WorkerRequest>): Promise<unknown[]> {
        const id = this.nextId++;

        return new Promise<unknown[]>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ ...request, id } as WorkerRequest);
        });
    }
}

/** One worker per page, shared by every database. Spawning one per store would be wasteful. */
let channel: WorkerChannel | null = null;

const resolveChannel = (workerUrl?: string | URL): WorkerChannel => {
    if (channel != null) {
        return channel;
    }

    channel = new WorkerChannel(workerUrl);

    return channel;
};

class WasmConnection implements SqliteConnection {

    constructor(
        private readonly channel: WorkerChannel,
        private readonly databaseName: string
    ) { }

    all(sql: string, params?: readonly unknown[]): Promise<unknown[]> {
        return this.channel.send({
            kind: 'all', databaseName: this.databaseName, sql, params: normalizeParams(params),
        });
    }

    async run(sql: string, params?: readonly unknown[]): Promise<void> {
        await this.channel.send({
            kind: 'run', databaseName: this.databaseName, sql, params: normalizeParams(params),
        });
    }

    /**
     * A no-op. The worker holds the database open; see `wasmWorker.ts`.
     *
     * The plugin closes on every path, which is right for a file handle and wrong for a
     * database that only exists while it is open. Releasing happens in `deleteDatabase`.
     */
    async close(): Promise<void> {
        return;
    }
}

export const wasmDriver = (options: WasmDriverOptions = {}): SqliteDriver => {
    const storage = options.storage ?? 'opfs';

    return {
        name: `sqlite-wasm (${storage})`,

        async open(databaseName: string): Promise<SqliteConnection> {
            const active = resolveChannel(options.workerUrl);

            // Opening twice is harmless: the worker keeps one database per name.
            await active.send({ kind: 'open', databaseName, storage });

            return new WasmConnection(active, databaseName);
        },

        async deleteDatabase(databaseName: string): Promise<void> {
            const active = resolveChannel(options.workerUrl);

            await active.send({ kind: 'delete', databaseName, storage });
        },
    };
};
