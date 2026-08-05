/**
 * Shared test infrastructure for the replication plugins.
 *
 * The important part is `installFetchMock`: unlike the first-generation mock it
 * honors `init.signal`, so request timeouts and `destroy()`-time aborts are
 * observable in tests instead of hanging them. A handler can hang forever
 * (`hang: true`) or answer after a delay, and an abort rejects the pending
 * promise with the reason the aborter supplied — which is how `RequestTracker`
 * reports both "timed out" and "plugin destroyed".
 */

import { jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import type { CompiledSchema } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import type { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { uuid } from '@routier/core/utilities';

/** What a handler tells the mock to answer with. */
export interface HttpResponseSpec {
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
    /** Answer only after this many ms (abortable). */
    delayMs?: number;
    /** Never answer at all — only an abort ends the request. */
    hang?: boolean;
}

export interface FetchCall {
    url: string;
    method: string;
    body: unknown;
    headers: Record<string, string>;
}

export type FetchHandler = (call: FetchCall) => HttpResponseSpec | Promise<HttpResponseSpec>;

function abortReason(signal: AbortSignal | undefined): Error {
    const reason = (signal as { reason?: unknown } | undefined)?.reason;
    return reason instanceof Error ? reason : new Error('The operation was aborted');
}

/** Resolves `produce()` after `delayMs` (or never, when hanging), rejecting on abort. */
function settleWhenAllowed<T>(signal: AbortSignal | undefined, delayMs: number, hang: boolean, produce: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (signal?.aborted === true) {
            reject(abortReason(signal));
            return;
        }

        const timer = hang ? null : setTimeout(() => {
            cleanup();
            resolve(produce());
        }, delayMs);
        (timer as { unref?: () => void } | null)?.unref?.();

        const onAbort = () => {
            if (timer != null) clearTimeout(timer);
            cleanup();
            reject(abortReason(signal));
        };

        function cleanup() {
            signal?.removeEventListener('abort', onAbort);
        }

        signal?.addEventListener('abort', onAbort);
    });
}

/**
 * Programmable global fetch. GET and POST handlers are swapped per test and every
 * call is recorded (url, method, parsed body, headers).
 */
export function installFetchMock() {
    const calls: FetchCall[] = [];
    let onGet: FetchHandler = () => ({ status: 200, body: [] });
    let onPost: FetchHandler = () => ({ status: 200, body: {} });

    const fetchMock = jest.fn(async (url: unknown, init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal }) => {
        const method = init?.method ?? 'GET';
        const call: FetchCall = {
            url: String(url),
            method,
            body: init?.body != null ? JSON.parse(init.body) : undefined,
            headers: init?.headers ?? {},
        };
        calls.push(call);

        const spec = await (method === 'GET' ? onGet(call) : onPost(call));

        return settleWhenAllowed(init?.signal, spec.delayMs ?? 0, spec.hang === true, () => ({
            ok: spec.status >= 200 && spec.status < 300,
            status: spec.status,
            statusText: `status-${spec.status}`,
            headers: { get: (name: string) => spec.headers?.[name] ?? spec.headers?.[name.toLowerCase()] ?? null },
            json: async () => spec.body ?? {},
        }));
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    return {
        calls,
        fetchMock,
        get gets() { return calls.filter((c) => c.method === 'GET'); },
        get posts() { return calls.filter((c) => c.method === 'POST'); },
        respondToGet(handler: FetchHandler) { onGet = handler; },
        respondToPost(handler: FetchHandler) { onPost = handler; },
    };
}

/**
 * Mirror of UnsyncedQueue's private schema, including the hardening columns.
 * MemoryPlugin resolves collections by name, so this reads the very rows the
 * queue writes.
 */
export const queueMirrorSchema = s
    .define('_routier_unsynced', {
        id: s.string().key().identity(),
        collectionName: s.string(),
        recordIds: s.string(),
        changeKind: s.string().optional(),
        entityJson: s.string(),
        revision: s.string().optional(),
        opId: s.string().optional(),
        status: s.string().optional(),
        attempts: s.number().optional(),
        seq: s.number().optional(),
    })
    .compile();

export interface QueueMirrorRow {
    id: string;
    collectionName: string;
    recordIds: string;
    changeKind?: string;
    entityJson: string;
    revision?: string;
    opId?: string;
    status?: string;
    attempts?: number;
    seq?: number;
}

/** A minimal two-column collection used by most tests. */
export const testSchema = s
    .define('swrHardening', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

export function schemasFor(schema: unknown): SchemaCollection {
    const schemas = new SchemaCollection();
    const compiled = schema as CompiledSchema<Record<string, unknown>>;
    schemas.set(compiled.id, compiled as never);
    return schemas;
}

export function createQueryEvent(schema: unknown = testSchema): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    return {
        id: uuid(8),
        schemas: schemasFor(schema),
        source: 'test',
        action: 'query',
        operation: Query.EMPTY(schema as never) as never,
    };
}

export interface PersistChangeSet {
    adds?: unknown[];
    /** Updates with no tracked delta — core's "write the whole entity" convention. */
    updates?: unknown[];
    /**
     * Updates carrying a delta, the way the change tracker reports a proxy mutation. These are
     * what the wire-format trim applies to; `updates` above exercises the whole-entity fallback.
     */
    updatesWithDelta?: Array<{ entity: unknown; delta: Record<string, unknown> }>;
    removes?: unknown[];
}

export function createPersistEvent(changes: PersistChangeSet, schema: unknown = testSchema): DbPluginBulkPersistEvent {
    const compiled = schema as CompiledSchema<Record<string, unknown>>;
    const operation = new BulkPersistChanges();
    const schemaChanges = operation.resolve(compiled.id);
    schemaChanges.adds = (changes.adds ?? []) as never[];
    schemaChanges.updates = [
        ...(changes.updates ?? []).map((entity) => ({ entity, changeType: 'markedDirty', delta: {} })),
        ...(changes.updatesWithDelta ?? []).map(({ entity, delta }) => ({ entity, changeType: 'propertiesChanged', delta })),
    ] as never[];
    schemaChanges.removes = (changes.removes ?? []) as never[];

    return {
        id: uuid(8),
        schemas: schemasFor(schema),
        source: 'test',
        action: 'persist',
        operation,
    };
}

export function destroyEvent() {
    return { id: uuid(8), schemas: new SchemaCollection(), source: 'test', action: 'destroy' } as never;
}

/** Runs a query through any IDbPlugin and returns the rows. */
export function queryPlugin(plugin: IDbPlugin, schema: unknown = testSchema): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        plugin.query(createQueryEvent(schema), (result) => {
            if (result.ok === Result.ERROR) {
                reject(result.error);
                return;
            }
            const rows: unknown[] = [];
            result.data.forEach((item: unknown) => rows.push(item));
            resolve(rows);
        });
    });
}

/**
 * Persists through a plugin and counts done() calls: a second ack is the exact
 * bug the "exactly one done() per event" invariant exists to prevent, so the
 * count is part of what tests assert on.
 */
export function persistPlugin(
    plugin: IDbPlugin,
    changes: PersistChangeSet,
    schema: unknown = testSchema,
    settleMs = 20
): Promise<{ callCount: number; result: unknown }> {
    return new Promise((resolve) => {
        let callCount = 0;
        plugin.bulkPersist(createPersistEvent(changes, schema), (result) => {
            callCount++;
            setTimeout(() => resolve({ callCount, result }), settleMs);
        });
    });
}

export function readQueueRows(queueStore: IDbPlugin): Promise<QueueMirrorRow[]> {
    return queryPlugin(queueStore, queueMirrorSchema) as Promise<QueueMirrorRow[]>;
}

/**
 * Writes queue rows straight into the backing store. MemoryDataCollection.add is an
 * upsert by id, so this also overwrites existing rows — used to fabricate rows in the
 * pre-hardening shape (no changeKind/revision/opId).
 */
export function writeQueueRows(queueStore: IDbPlugin, rows: Array<Partial<QueueMirrorRow>>): Promise<void> {
    return new Promise((resolve, reject) => {
        const operation = new BulkPersistChanges();
        operation.resolve(queueMirrorSchema.id).adds = rows as never[];
        queueStore.bulkPersist(
            {
                id: uuid(8),
                schemas: schemasFor(queueMirrorSchema),
                source: 'test',
                action: 'persist',
                operation,
            } as never,
            (result) => (result.ok === Result.ERROR ? reject(result.error) : resolve())
        );
    });
}

/** Polls `predicate` until it holds or the deadline passes. */
export async function waitFor(predicate: () => boolean | Promise<boolean>, message: string, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    for (; ;) {
        if (await predicate()) return;
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for: ${message}`);
        }
        await sleep(10);
    }
}

export async function waitForRowCount(store: IDbPlugin, count: number, schema: unknown = testSchema, timeoutMs = 2000): Promise<unknown[]> {
    let rows: unknown[] = [];
    await waitFor(async () => {
        rows = await queryPlugin(store, schema);
        return rows.length === count;
    }, `${count} rows in ${(schema as CompiledSchema<Record<string, unknown>>).collectionName}`, timeoutMs);
    return rows;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Keeps the background flush from polluting per-test fetch counts. The
 * `isDestroyed` reset is the established idiom in this package: stopBackgroundSync
 * doubles as the destroy latch, and tests still need a live plugin afterwards.
 */
export function suspendBackgroundSync(plugin: unknown): void {
    (plugin as { stopBackgroundSync: () => void }).stopBackgroundSync();
    (plugin as { isDestroyed: boolean }).isDestroyed = false;
}
