/**
 * The worker that actually owns the database.
 *
 * OPFS persistence is only reachable from a worker. `FileSystemFileHandle.createSyncAccessHandle`
 * — the synchronous handle every OPFS VFS is built on — is not defined on the main thread, so
 * a main-thread driver fails at `installOpfsSAHPoolVfs` with "Missing required OPFS APIs" no
 * matter how the page is served. SQLite's own documentation says the same: only the worker
 * versions can use OPFS.
 *
 * So the driver spawns this, and talks to it in request/response pairs. Everything here runs
 * inside the worker; nothing in this file may touch `window` or `document`.
 *
 * The engine is imported statically. A dynamic `import()` would be pointless — this file
 * exists only to run SQLite, so there is nothing to defer — and actively harmful: the
 * published file is already a bundle, and a consumer bundling it again produced a nested
 * module registry that failed at runtime with "__webpack_modules__[moduleId] is not a
 * function". A static import has no such runtime.
 *
 * The VFS is `opfs-sahpool` rather than the plain `opfs` one. Both need a worker, but plain
 * `opfs` also needs `SharedArrayBuffer`, which needs cross-origin isolation, which needs the
 * page to send COOP and COEP headers. The SAH pool needs none of that, so a consumer can serve
 * an ordinary page.
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { ensurePoolCapacity, isPoolFull, poolFullError } from './wasmPool';

type WasmStatement = {
    bind(params: unknown[]): void;
    step(): boolean;
    get(row: Record<string, unknown>): Record<string, unknown>;
    finalize(): void;
};

type WasmDatabase = {
    prepare(sql: string): WasmStatement;
    exec(options: { sql: string }): void;
    close(): void;
};

export type WorkerRequest =
    | { id: number; kind: 'open'; databaseName: string; storage: 'opfs' | 'memory' }
    | { id: number; kind: 'all'; databaseName: string; sql: string; params: unknown[] }
    | { id: number; kind: 'run'; databaseName: string; sql: string; params: unknown[] }
    | { id: number; kind: 'delete'; databaseName: string; storage: 'opfs' | 'memory' };

export type WorkerResponse =
    | { id: number; ok: true; rows?: unknown[] }
    | { id: number; ok: false; error: string };

const databases = new Map<string, WasmDatabase>();

/** Opens in flight, so concurrent operations on one name share a single open. */
const openings = new Map<string, Promise<WasmDatabase>>();

let modulePromise: Promise<any> | null = null;
let poolPromise: Promise<any> | null = null;

const loadModule = () => {
    if (modulePromise == null) {
        modulePromise = sqlite3InitModule();
    }

    return modulePromise;
};

const loadPool = async (storage: 'opfs' | 'memory') => {
    const sqlite3 = await loadModule();

    if (storage === 'memory') {
        return null;
    }

    if (typeof sqlite3.installOpfsSAHPoolVfs !== 'function') {
        throw new Error(
            'This build of @sqlite.org/sqlite-wasm cannot install the OPFS SAH pool VFS. ' +
            "Use `wasmDriver({ storage: 'memory' })` if persistence is not required."
        );
    }

    if (poolPromise == null) {
        // Acquiring the pool twice fails, so it is cached even across databases.
        poolPromise = sqlite3.installOpfsSAHPoolVfs({});
    }

    return poolPromise;
};

/**
 * One database per name, held open for the life of the worker.
 *
 * A `:memory:` database *is* its connection, so reopening per operation would hand every query
 * an empty database. OPFS would survive that but pay a pool acquisition each time, and the SAH
 * pool takes exclusive handles, so churning them invites an avoidable "database is locked".
 */
const openDatabase = (databaseName: string, storage: 'opfs' | 'memory'): Promise<WasmDatabase> => {
    const existing = databases.get(databaseName);

    if (existing != null) {
        return Promise.resolve(existing);
    }

    // Memoised while it is in flight. Two operations arriving together on one name would
    // otherwise each open the database — two pool slots for one name, and each one growing the
    // pool for the other. Nothing between the first `await` and `databases.set` yields the map.
    const opening = openings.get(databaseName) ?? beginOpen(databaseName, storage);

    openings.set(databaseName, opening);

    return opening.finally(() => openings.delete(databaseName));
};

const beginOpen = async (databaseName: string, storage: 'opfs' | 'memory'): Promise<WasmDatabase> => {
    const sqlite3 = await loadModule();
    const pool = await loadPool(storage);

    if (pool != null) {
        await ensurePoolCapacity(pool);
    }

    const database: WasmDatabase = pool == null
        ? new sqlite3.oo1.DB(':memory:')
        : openPooled(pool, databaseName);

    databases.set(databaseName, database);

    return database;
};

const openPooled = (pool: any, databaseName: string): WasmDatabase => {
    try {
        return new pool.OpfsSAHPoolDb(`/${databaseName}`);
    } catch (error) {
        throw isPoolFull(error) ? poolFullError(pool, databaseName) : error;
    }
};

const readRows = (statement: WasmStatement): unknown[] => {
    const rows: unknown[] = [];

    while (statement.step()) {
        rows.push(statement.get({}));
    }

    return rows;
};

/**
 * Runs a statement and returns its rows.
 *
 * Always prepares, even with no parameters. Routing parameterless statements through `exec`
 * looks like a harmless shortcut and is not: `exec` reports nothing, so `SELECT * FROM users`
 * — which takes no parameters — came back empty while the same query *with* a parameter came
 * back correctly. A read that silently returns zero rows is the worst shape a bug can take.
 */
const queryStatement = (database: WasmDatabase, sql: string, params: unknown[]): unknown[] => {
    const statement = database.prepare(sql);

    try {
        if (params.length > 0) {
            statement.bind(params);
        }

        return readRows(statement);
    } finally {
        // Not finalising leaks the statement and holds a lock, which surfaces later as an
        // unrelated "database is locked".
        statement.finalize();
    }
};

/**
 * Runs a statement whose rows are not wanted.
 *
 * `exec` is used only here, and only without parameters, because it accepts statements
 * `prepare` will not — transaction control and DDL.
 */
const executeStatement = (database: WasmDatabase, sql: string, params: unknown[]): void => {
    if (params.length === 0) {
        database.exec({ sql });
        return;
    }

    queryStatement(database, sql, params);
};

const handle = async (request: WorkerRequest): Promise<unknown[]> => {
    if (request.kind === 'open') {
        await openDatabase(request.databaseName, request.storage);
        return [];
    }

    if (request.kind === 'delete') {
        const open = databases.get(request.databaseName);

        if (open != null) {
            open.close();
            databases.delete(request.databaseName);
        }

        if (request.storage === 'memory') {
            // An in-memory database is gone once closed; there is no stored copy to unlink.
            return [];
        }

        // Install the pool rather than reusing whatever is cached. A destroy can be the very
        // first thing a page does — a test clearing state before it runs — and then nothing
        // has opened a database yet, so the cached pool is null and the unlink silently does
        // nothing. That reads exactly like a successful destroy and leaves the data in place.
        const pool = await loadPool('opfs');

        pool?.unlink(`/${request.databaseName}`);

        return [];
    }

    const database = databases.get(request.databaseName);

    if (database == null) {
        throw new Error(`database '${request.databaseName}' is not open`);
    }

    if (request.kind === 'all') {
        return queryStatement(database, request.sql, request.params);
    }

    executeStatement(database, request.sql, request.params);

    return [];
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    try {
        const rows = await handle(request);

        (self as unknown as Worker).postMessage({ id: request.id, ok: true, rows } satisfies WorkerResponse);
    } catch (error) {
        // Errors do not survive structured cloning with their prototype, and the plugin only
        // reads `message` — it classifies a missing table by text. Send the string.
        (self as unknown as Worker).postMessage({
            id: request.id,
            ok: false,
            error: (error as Error)?.message ?? String(error),
        } satisfies WorkerResponse);
    }
};
