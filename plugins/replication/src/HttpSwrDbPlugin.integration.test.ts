import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { createRetry } from './retry';
import type { SwrRequestError } from './syncHooks';
import { waitFor } from './__tests__/httpTestKit';
import type { DbPluginQueryEvent, DbPluginBulkPersistEvent, IDbPlugin } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';

/**
 * Integration tests: real MemoryPlugin as the SWR store and the unsynced-queue store,
 * with global fetch mocked. These drive the plugin through the same IDbPlugin surface
 * the datastore uses, so the local-persist/ack/queue/flush machinery runs for real.
 */

const testSchema = s
    .define('swrIntegration', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

// Mirror of UnsyncedQueue's private schema — MemoryPlugin resolves collections by
// name, so this reads the same rows the queue writes.
const queueMirrorSchema = s
    .define('_routier_unsynced', {
        id: s.string().key().identity(),
        collectionName: s.string(),
        recordIds: s.string(),
        changeKind: s.string().optional(),
        entityJson: s.string(),
    })
    .compile();

type FetchCall = { url: string; method: string; body: unknown };

/** Programmable fetch: GET and POST handlers swap per test; every call is recorded. */
function installFetchMock() {
    const calls: FetchCall[] = [];
    let onGet: () => { status: number; body?: unknown } = () => ({ status: 200, body: [] });
    let onPost: () => { status: number; body?: unknown } = () => ({ status: 200, body: {} });

    const fetchMock = jest.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
        const method = init?.method ?? 'GET';
        calls.push({ url: String(url), method, body: init?.body != null ? JSON.parse(init.body) : undefined });
        const response = method === 'GET' ? onGet() : onPost();
        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: `status-${response.status}`,
            json: async () => response.body ?? {},
        };
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    return {
        calls,
        fetchMock,
        get gets() { return calls.filter((c) => c.method === 'GET'); },
        get posts() { return calls.filter((c) => c.method === 'POST'); },
        respondToGet(handler: () => { status: number; body?: unknown }) { onGet = handler; },
        respondToPost(handler: () => { status: number; body?: unknown }) { onPost = handler; },
    };
}

function createQueryEvent(): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return {
        id: uuid(8),
        schemas,
        source: 'test',
        action: 'query',
        explain: false,
        executedQueries: [],
        operation: Query.EMPTY(testSchema as any) as any,
    };
}

function createPersistEvent(changes: { adds?: unknown[]; updates?: unknown[]; removes?: unknown[] }): DbPluginBulkPersistEvent {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    const operation = new BulkPersistChanges();
    const schemaChanges = operation.resolve(testSchema.id);
    schemaChanges.adds = (changes.adds ?? []) as never[];
    schemaChanges.updates = (changes.updates ?? []).map((entity) => ({ entity, changeType: 'markedDirty', delta: {} })) as never[];
    schemaChanges.removes = (changes.removes ?? []) as never[];
    return {
        id: uuid(8),
        schemas,
        source: 'test',
        action: 'persist',
        operation,
    };
}

function queryPlugin(plugin: IDbPlugin, schema: any = testSchema): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        const schemas = new SchemaCollection();
        schemas.set(schema.id, schema);
        const event: DbPluginQueryEvent<Record<string, unknown>, unknown> = {
            id: uuid(8),
            schemas,
            source: 'test',
            action: 'query',
            explain: false,
            executedQueries: [],
            operation: Query.EMPTY(schema) as any,
        };
        plugin.query(event, (result) => {
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

function persistPlugin(plugin: IDbPlugin, changes: { adds?: unknown[]; updates?: unknown[]; removes?: unknown[] }) {
    return new Promise<{ callCount: number; result: unknown }>((resolve) => {
        let callCount = 0;
        plugin.bulkPersist(createPersistEvent(changes), (result) => {
            callCount++;
            // Give a possible (buggy) second done() a chance to arrive before resolving
            setTimeout(() => resolve({ callCount, result }), 20);
        });
    });
}

/** Polls until the store contains `count` rows or times out. */
async function waitForRowCount(store: IDbPlugin, count: number, timeoutMs = 2000, schema: any = testSchema): Promise<unknown[]> {
    const start = Date.now();
    for (;;) {
        const rows = await queryPlugin(store, schema);
        if (rows.length === count) return rows;
        if (Date.now() - start > timeoutMs) {
            throw new Error(`store never reached ${count} rows; has ${rows.length}`);
        }
        await new Promise((r) => setTimeout(r, 10));
    }
}

describe('HttpSwrDbPlugin integration', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    let plugin: HttpSwrDbPlugin;
    let failures: SwrRequestError[];

    function createPlugin(options?: Partial<ConstructorParameters<typeof HttpSwrDbPlugin>[1]>) {
        const created = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            onError: (error) => {
                failures.push(error);
                return error.operation === 'write' ? error.defer() : error.done();
            },
            writeBatchDelayMs: 0,
            ...options,
        });
        return created;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        failures = [];
        plugin = createPlugin();
    });

    afterEach((done) => {
        plugin.destroy({ id: uuid(8), schemas: new SchemaCollection(), source: 'test', action: 'destroy' } as any, () => done());
    });

    describe('query (SWR read path)', () => {
        it('cache miss: fetches from remote, persists to store, and returns the rows', async () => {
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }] }));

            const rows = await queryPlugin(plugin);

            expect(rows).toHaveLength(2);
            expect(http.gets).toHaveLength(1);
            // The fetched rows are now durable in the SWR store
            const stored = await queryPlugin(swrStore);
            expect(stored).toHaveLength(2);
        });

        it('fresh cache hit: serves from the store without touching the remote', async () => {
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice' }] }));
            await queryPlugin(plugin); // miss → fetch → marks revalidated

            const rows = await queryPlugin(plugin);

            expect(rows).toHaveLength(1);
            expect(http.gets).toHaveLength(1); // still just the initial fetch
        });

        it('stale cache hit: serves cached data immediately, then revalidates in the background', async () => {
            plugin.destroy({ id: uuid(8), schemas: new SchemaCollection(), source: 'test', action: 'destroy' } as any, () => undefined);
            plugin = createPlugin({ maxAgeMs: 0 });
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice' }] }));
            await queryPlugin(plugin); // seed store

            // Server data changed since the seed
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice v2' }, { id: 'c', name: 'Cara' }] }));

            const rows = await queryPlugin(plugin);
            // Stale-while-revalidate: the caller gets the OLD data now...
            expect(rows).toEqual([expect.objectContaining({ name: 'Alice' })]);

            // ...and the store catches up in the background
            const refreshed = await waitForRowCount(swrStore, 2);
            expect(refreshed).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Alice v2' }),
                expect.objectContaining({ name: 'Cara' }),
            ]));
        });

        it('cache miss with remote down: fails rather than answering with an empty store', async () => {
            http.respondToGet(() => ({ status: 500 }));

            await expect(queryPlugin(plugin)).rejects.toThrow('HTTP 500');
        });

        it('cache miss with remote down: answers from the store when onError uses the cache', async () => {
            plugin = createPlugin({ onError: (error) => (error.operation === 'read' ? error.useCached() : error.defer()) });
            http.respondToGet(() => ({ status: 500 }));

            expect(await queryPlugin(plugin)).toEqual([]);
        });

        it('cache miss with 401: asks onError with the status', async () => {
            http.respondToGet(() => ({ status: 401 }));

            await expect(queryPlugin(plugin)).rejects.toThrow('HTTP 401');

            expect(failures.map(error => [error.kind, error.kind === 'http' ? error.status : null, error.operation])).toEqual([['http', 401, 'read']]);
        });
    });

    describe('bulkPersist (optimistic write path)', () => {
        it('acks success exactly once even when every POST fails', async () => {
            http.respondToPost(() => ({ status: 500 }));

            const { callCount, result } = await persistPlugin(plugin, { adds: [{ name: 'Offline Add' }] });

            expect(callCount).toBe(1);
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            // Local store has the entity despite the remote failure
            const stored = await queryPlugin(swrStore);
            expect(stored).toHaveLength(1);
        });

        it('sends a failed write once when onError does not retry it', async () => {
            http.respondToPost(() => ({ status: 500 }));

            await persistPlugin(plugin, { adds: [{ name: 'One Shot' }] });
            await waitFor(() => failures.length === 1, 'the failure');

            expect(http.posts).toHaveLength(1);
        });

        it('sends a failed write again when onError retries it', async () => {
            plugin = createPlugin({ onError: (error) => void error.retry() });
            let postCount = 0;
            http.respondToPost(() => (++postCount === 1 ? { status: 500 } : { status: 200, body: {} }));

            await persistPlugin(plugin, { adds: [{ name: 'Retry Me' }] });

            await waitForRowCount(queueStore, 0, 2000, queueMirrorSchema);
            expect(http.posts).toHaveLength(2);
        });

        it('sends updates as plain entities in the POST body (same wire shape as HttpDbPlugin)', async () => {
            http.respondToPost(() => ({ status: 200, body: {} }));

            await persistPlugin(plugin, { updates: [{ id: 'u1', name: 'Updated' }] });
            await new Promise((r) => setTimeout(r, 50));

            expect(http.posts).toHaveLength(1);
            expect(http.posts[0].body).toEqual({
                adds: [],
                updates: [{ id: 'u1', name: 'Updated' }],
                removes: [],
                // Additive idempotency metadata: one opId per change, parallel to the arrays
                meta: { opIds: { adds: [], updates: [expect.any(String)], removes: [] } },
            });
        });

        it('drains the unsynced queue after a successful POST', async () => {
            http.respondToPost(() => ({ status: 200, body: {} }));

            await persistPlugin(plugin, { adds: [{ name: 'Synced' }] });
            await waitForRowCount(queueStore, 0, 2000, queueMirrorSchema);
        });

        it('keeps failed changes queued, and syncNow replays them with their original kinds', async () => {
            http.respondToPost(() => ({ status: 500 }));

            await persistPlugin(plugin, {
                adds: [{ id: 'add-1', name: 'Queued Add' }],
                removes: [{ id: 'rem-1', name: 'Queued Remove' }],
            });

            // Both changes wait in the queue — including the REMOVE
            const queued = await waitForRowCount(queueStore, 2, 2000, queueMirrorSchema);
            expect((queued as Array<{ changeKind: string }>).map((r) => r.changeKind).sort()).toEqual(['add', 'remove']);

            // Remote comes back: flush replays each change with its kind
            http.respondToPost(() => ({ status: 200, body: {} }));
            const outcome = await plugin.syncNow();

            expect(outcome).toEqual({ sent: 2, failed: 0, rejected: 0 });
            const flushPost = http.posts[http.posts.length - 1];
            expect(flushPost.body).toEqual({
                adds: [expect.objectContaining({ id: 'add-1' })],
                updates: [],
                removes: [expect.objectContaining({ id: 'rem-1' })],
                meta: { opIds: { adds: [expect.any(String)], updates: [], removes: [expect.any(String)] } },
            });
            await waitForRowCount(queueStore, 0, 2000, queueMirrorSchema);
        });

        it('401 on POST is not retried by createRetry, and stays queued', async () => {
            const backoff = createRetry({ baseDelayMs: 1, maxAttempts: 5 });
            plugin = createPlugin({ onError: (error) => { failures.push(error); backoff(error); } });
            http.respondToPost(() => ({ status: 401 }));

            await persistPlugin(plugin, { adds: [{ name: 'Denied' }] });
            await waitFor(() => failures.length === 1, 'the failure');
            await new Promise((r) => setTimeout(r, 50));

            expect(http.posts).toHaveLength(1);
            expect(failures.map(error => [error.kind === 'http' ? error.status : null, error.operation])).toEqual([[401, 'write']]);
            expect(await plugin.pendingCount()).toBe(1);
        });
    });

    describe('revalidate vs pending local changes', () => {
        it('does not resurrect a locally-removed row the server still returns', async () => {
            // Seed the store + server with one row, all synced
            http.respondToGet(() => ({ status: 200, body: [{ id: 'victim', name: 'To Remove' }] }));
            await queryPlugin(plugin);

            // Remove locally; the POST fails so the remove stays queued
            http.respondToPost(() => ({ status: 500 }));
            await persistPlugin(plugin, { removes: [{ id: 'victim', name: 'To Remove' }] });
            expect(await queryPlugin(swrStore)).toHaveLength(0);

            // Server still returns the row (it never saw the remove). Revalidate must
            // NOT classify it as an add while the remove is pending.
            await (plugin as any).persistToStore(createQueryEvent(), {
                value: [{ id: 'victim', name: 'To Remove' }],
                forEach: (cb: (item: unknown) => void) => cb({ id: 'victim', name: 'To Remove' }),
            });

            expect(await queryPlugin(swrStore)).toHaveLength(0);
        });

        it('does not clobber a pending local update with the stale server copy', async () => {
            http.respondToGet(() => ({ status: 200, body: [{ id: 'e1', name: 'Server v1' }] }));
            await queryPlugin(plugin);

            http.respondToPost(() => ({ status: 500 }));
            await persistPlugin(plugin, { updates: [{ id: 'e1', name: 'Local Edit' }] });

            await (plugin as any).persistToStore(createQueryEvent(), {
                value: [{ id: 'e1', name: 'Server v1' }],
                forEach: (cb: (item: unknown) => void) => cb({ id: 'e1', name: 'Server v1' }),
            });

            const rows = await queryPlugin(swrStore) as Array<{ name: string }>;
            expect(rows).toHaveLength(1);
            expect(rows[0].name).toBe('Local Edit');
        });
    });
});
