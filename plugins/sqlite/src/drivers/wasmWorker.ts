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
import { readRows, type WasmStatement } from './wasmRows';
import { streamChunks } from './wasmChunks';
import { rawSqliteFrom, type RawSqlite } from './wasmRaw';
import type { EncodedChunk, TransferPlan } from '@routier/core/transfer';

type WasmDatabase = {
    prepare(sql: string): WasmStatement;
    exec(options: { sql: string }): void;
    close(): void;
};

export type WorkerRequest =
    | { id: number; kind: 'open'; databaseName: string; storage: 'opfs' | 'memory' }
    /**
     * `plan` present means: encode the rows columnar and stream them back as chunks. Absent means
     * clone them, which is the only thing this worker did before and still the fallback for
     * everything the plan cannot describe.
     */
    | { id: number; kind: 'all'; databaseName: string; sql: string; params: unknown[]; plan?: TransferPlan }
    | { id: number; kind: 'run'; databaseName: string; sql: string; params: unknown[] }
    | { id: number; kind: 'delete'; databaseName: string; storage: 'opfs' | 'memory' };

export type WorkerResponse =
    /** Uncoded result, or an operation with no rows. One message per request. */
    | { id: number; ok: true; rows?: unknown[] }
    /** Coded result, 1..N messages in order, the last carrying `last: true`. */
    | { id: number; ok: true; chunk: EncodedChunk; last: boolean }
    | { id: number; ok: false; error: string };

const post = (response: WorkerResponse, transferables: readonly ArrayBufferLike[] = []): void => {
    // The transfer list is a separate argument, never part of the payload. A transport that
    // ignores it still delivers a correct message; the buffers are just copied instead of moved.
    (self as unknown as Worker).postMessage(response, transferables as Transferable[]);
};

const databases = new Map<string, WasmDatabase>();

/** Opens in flight, so concurrent operations on one name share a single open. */
const openings = new Map<string, Promise<WasmDatabase>>();

/**
 * The raw reading surface, built once when the module loads.
 *
 * Bound to the module rather than per statement: it holds only the export table and a
 * `TextDecoder`, and both are the same for every database this worker serves.
 */
let rawSqlite: RawSqlite | null = null;

const rawApi = (): RawSqlite => {
    if (rawSqlite == null) {
        throw new Error('The SQLite module has not finished loading.');
    }

    return rawSqlite;
};

let modulePromise: Promise<any> | null = null;
let poolPromise: Promise<any> | null = null;

const loadModule = () => {
    if (modulePromise == null) {
        modulePromise = sqlite3InitModule().then((sqlite3: any) => {
            rawSqlite = rawSqliteFrom(sqlite3.wasm);

            return sqlite3;
        });
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

type ReusableStatement = WasmStatement & { reset(): void; clearBindings(): void };

const STATEMENT_CACHE_MAX = 64;

const statementCaches = new WeakMap<WasmDatabase, Map<string, ReusableStatement>>();

const acquireStatement = (database: WasmDatabase, sql: string): ReusableStatement => {
    let cache = statementCaches.get(database);

    if (cache == null) {
        cache = new Map();
        statementCaches.set(database, cache);
    }

    const cached = cache.get(sql);

    if (cached != null) {
        cache.delete(sql);
        cache.set(sql, cached);
        return cached;
    }

    const statement = database.prepare(sql) as ReusableStatement;
    cache.set(sql, statement);

    if (cache.size > STATEMENT_CACHE_MAX) {
        const [oldestSql, oldest] = cache.entries().next().value as [string, ReusableStatement];
        cache.delete(oldestSql);
        oldest.finalize();
    }

    return statement;
};

const discardBrokenStatement = (database: WasmDatabase, sql: string, statement: ReusableStatement): void => {
    statementCaches.get(database)?.delete(sql);
    try {
        statement.finalize();
    } catch {
        return;
    }
};

const releaseStatement = (database: WasmDatabase, sql: string, statement: ReusableStatement): void => {
    try {
        statement.reset();
        statement.clearBindings();
    } catch (error) {
        discardBrokenStatement(database, sql, statement);
        throw error;
    }
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
    const statement = acquireStatement(database, sql);

    try {
        if (params.length > 0) {
            statement.bind(params);
        }

        return readRows(rawApi(), statement);
    } finally {
        // Not resetting leaks the statement's cursor and holds a lock, which surfaces later
        // as an unrelated "database is locked".
        releaseStatement(database, sql, statement);
    }
};

/**
 * Runs a statement and streams its rows back as columnar chunks.
 *
 * Posts as it goes rather than collecting: the main thread decodes chunk *k* while this fills
 * *k+1*, which is where most of the codec's win comes from. Every typed array in a chunk is
 * listed as transferable, so its buffer changes owner instead of being copied — and is DETACHED
 * here the moment it is posted, which is why nothing reads a chunk after emitting it.
 */
const streamStatement = (
    database: WasmDatabase,
    request: { id: number; sql: string; params: unknown[]; plan: TransferPlan }
): void => {
    const statement = acquireStatement(database, request.sql);

    try {
        if (request.params.length > 0) {
            statement.bind(request.params);
        }

        streamChunks(rawApi(), statement, request.plan, ({ payload, transferables }, last) => {
            post({ id: request.id, ok: true, chunk: payload, last }, transferables);
        });
    } finally {
        releaseStatement(database, request.sql, statement);
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
        if (request.kind === 'all' && request.plan != null) {
            const database = databases.get(request.databaseName);

            if (database == null) {
                throw new Error(`database '${request.databaseName}' is not open`);
            }

            // Answers with 1..N messages instead of one. A failure part way through is reported
            // the same as any other, and the driver discards the chunks it already had.
            streamStatement(database, { id: request.id, sql: request.sql, params: request.params, plan: request.plan });
            return;
        }

        const rows = await handle(request);

        post({ id: request.id, ok: true, rows });
    } catch (error) {
        // Errors do not survive structured cloning with their prototype, and the plugin only
        // reads `message` — it classifies a missing table by text. Send the string.
        post({
            id: request.id,
            ok: false,
            error: (error as Error)?.message ?? String(error),
        });
    }
};
