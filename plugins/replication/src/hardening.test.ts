import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MemoryPlugin } from '@routier/memory-plugin';
import { s } from '@routier/core/schema';
import type { ISchemaSubscription } from '@routier/core/schema';
import { Result } from '@routier/core/results';
import { uuid } from '@routier/core/utilities';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { HttpDbPlugin } from './HttpDbPlugin';
import { PluginSyncEngine } from './PluginSyncEngine';
import { UnsyncedQueue } from './UnsyncedQueue';
import type { DeadLetteredChange, QueuedChange } from './UnsyncedQueue';
import type { SyncOutcome } from './HttpSwrDbPlugin';
import { backoffDelayMs, isAuthStatus, isConflictStatus, isPermanentStatus, KeyedMutex, readRetryAfterMs, RequestPacer } from './httpUtils';
import {
    createQueryEvent,
    destroyEvent,
    installFetchMock,
    persistPlugin,
    queryPlugin,
    queueMirrorSchema,
    readQueueRows,
    sleep,
    testSchema,
    waitFor,
    waitForRowCount,
    writeQueueRows,
} from './__tests__/httpTestKit';

/**
 * Tier 4a: dedicated coverage for the hardening behaviors — dead-lettering, poison
 * isolation, conflict reporting, compare-and-delete dequeue, the re-auth handshake,
 * request timeouts, the sync-engine guards, backoff/Retry-After, echo reconciliation,
 * the `online` trigger, and queue coalescing.
 */

/** Minimal ITranslatedValue over a row array, for driving the private revalidate paths. */
function translated(rows: unknown[]) {
    return {
        value: rows,
        get isEmpty() { return rows.length === 0; },
        forEach: (cb: (item: unknown) => void) => rows.forEach(cb),
    } as never;
}

type SwrOptions = Partial<ConstructorParameters<typeof HttpSwrDbPlugin>[1]>;

/** Drains the microtask queue so promise chains handed off between awaits can advance. */
async function settleMicrotasks(turns = 8): Promise<void> {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
}

describe('hardening: dead-letter and poison isolation', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    let plugin: HttpSwrDbPlugin;
    let deadLetters: DeadLetteredChange[][];
    let conflicts: Array<{ collectionName: string; entities: unknown[] }>;

    function createPlugin(options?: SwrOptions) {
        const created = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 1,
            writeBatchDelayMs: 0,
            onSyncDeadLetter: (changes) => { deadLetters.push(changes); },
            onConflict: ({ collectionName, entities }) => { conflicts.push({ collectionName, entities }); },
            ...options,
        });
        return created;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        deadLetters = [];
        conflicts = [];
        plugin = createPlugin();
    });

    afterEach((done) => {
        plugin.destroy(destroyEvent(), () => done());
    });

    it('dead-letters a permanently rejected change, reports it once, and stops retrying it', async () => {
        http.respondToPost(() => ({ status: 422 }));

        await persistPlugin(plugin, { adds: [{ id: 'bad-1', name: 'Malformed' }] });

        // The direct POST path leaves it queued; only the flush gives up on it
        expect(await readQueueRows(queueStore)).toHaveLength(1);
        expect(deadLetters).toHaveLength(0);

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 0, failed: 0, deadLettered: 1 });
        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('dead');
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0]).toEqual([
            expect.objectContaining({ collectionName: 'swrHardening', kind: 'add', entity: expect.objectContaining({ id: 'bad-1' }) }),
        ]);

        // A dead row no longer shields its entity: the server's view (no such row) wins
        await (plugin as never as { persistToStore: (e: unknown, t: unknown) => Promise<void> })
            .persistToStore(createQueryEvent(), translated([]));
        expect(await queryPlugin(swrStore)).toHaveLength(0);

        // ...and the queue stops spending requests on it
        const postsBefore = http.posts.length;
        const second = await plugin.syncNow();
        expect(second).toEqual({ flushed: 0, failed: 0, deadLettered: 0 });
        expect(http.posts).toHaveLength(postsBefore);
    });

    it('dead-letters a structured whole-batch rejection without per-item fan-out', async () => {
        http.respondToPost(() => ({ status: 422, body: { rejectionScope: 'batch' } }));

        await persistPlugin(plugin, {
            adds: Array.from({ length: 10 }, (_, i) => ({ id: `global-${i}`, name: `Item ${i}` })),
        });
        const postsBeforeFlush = http.posts.length;

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 0, failed: 0, deadLettered: 10 });
        expect(http.posts.length - postsBeforeFlush).toBe(1);
        expect(await plugin.pendingCount()).toBe(0);
        expect(await plugin.deadLetters()).toHaveLength(10);
    });

    it('dead-letters named poison opIds and retries all remaining items as one batch', async () => {
        http.respondToPost(() => ({ status: 400 }));
        await persistPlugin(plugin, {
            adds: [
                { id: 'good-a', name: 'Good A' },
                { id: 'named-poison', name: 'Poison' },
                { id: 'good-b', name: 'Good B' },
            ],
        });
        const queued = await readQueueRows(queueStore);
        const poison = queued.find((row) => JSON.parse(row.entityJson).id === 'named-poison');
        expect(poison?.opId).toEqual(expect.any(String));

        let batchRejected = false;
        http.respondToPost(() => {
            if (!batchRejected) {
                batchRejected = true;
                return { status: 400, body: { rejectedOpIds: [poison!.opId] } };
            }
            return { status: 200, body: {} };
        });
        const postsBeforeFlush = http.posts.length;

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 2, failed: 0, deadLettered: 1 });
        expect(http.posts.length - postsBeforeFlush).toBe(2);
        expect(await plugin.pendingCount()).toBe(0);
        expect((await plugin.deadLetters()).map((row) => JSON.parse(row.entityJson).id)).toEqual(['named-poison']);
    });

    it('isolates the poison item: a batch the server 400s flushes the units it accepts', async () => {
        http.respondToPost(() => ({ status: 400 }));

        await persistPlugin(plugin, {
            adds: [
                { id: 'ok-1', name: 'Fine' },
                { id: 'poison', name: 'Poison' },
                { id: 'ok-2', name: 'Also fine' },
            ],
        });
        expect(await readQueueRows(queueStore)).toHaveLength(3);

        // Batch still rejected; individually the server takes everything but the poison row
        http.respondToPost((call) => {
            const body = call.body as { adds: Array<{ id: string }> };
            if (body.adds.length > 1) return { status: 400 };
            return body.adds[0].id === 'poison' ? { status: 400 } : { status: 200, body: {} };
        });

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 2, failed: 0, deadLettered: 1 });
        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('dead');
        expect(JSON.parse(rows[0].entityJson)).toEqual(expect.objectContaining({ id: 'poison' }));
        expect(deadLetters.flat()).toHaveLength(1);
    });

    it('reports 409 through onConflict on the direct path and again when the flush dead-letters it', async () => {
        http.respondToPost(() => ({ status: 409 }));

        await persistPlugin(plugin, { adds: [{ id: 'dup', name: 'Duplicate' }] });

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toEqual({
            collectionName: 'swrHardening',
            entities: [expect.objectContaining({ id: 'dup' })],
        });

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 0, failed: 0, deadLettered: 1 });
        expect(conflicts).toHaveLength(2);
        expect(deadLetters.flat()).toHaveLength(1);
    });

    it('keeps transiently failing changes queued instead of dead-lettering them', async () => {
        http.respondToPost(() => ({ status: 503 }));

        await persistPlugin(plugin, { adds: [{ id: 't-1', name: 'Later' }] });
        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 0, failed: 1, deadLettered: 0 });
        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('pending');
        expect(rows[0].attempts).toBeGreaterThan(0);
        expect(deadLetters).toHaveLength(0);
    });
});

describe('hardening: compare-and-delete dequeue', () => {
    let queueStore: MemoryPlugin;
    let queue: UnsyncedQueue;

    beforeEach(() => {
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        queue = new UnsyncedQueue(queueStore);
    });

    it('confirming an old change does not delete the row a newer edit overwrote', async () => {
        const first: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [first]);
        const confirmedFirst: QueuedChange = { ...first };

        // A newer local edit replaces the row (same collection + kind + ids → same row id)
        const second: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v2' } };
        await queue.addMany(testSchema as never, [second]);
        expect(second.revision).not.toBe(first.revision);

        await queue.removeMany(testSchema as never, [confirmedFirst]);

        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(rows[0].revision).toBe(second.revision);
        expect(JSON.parse(rows[0].entityJson)).toEqual({ id: 'e1', name: 'v2' });

        // Confirming the current revision does clear it
        await queue.removeMany(testSchema as never, [second]);
        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('a confirmed change retires the older queued changes it supersedes', async () => {
        // The add never reached the server, so it stays queued...
        const add: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [add]);

        // ...and then the entity is removed, and that POST does land
        const remove: QueuedChange = { kind: 'remove', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [remove]);
        await queue.removeMany(testSchema as never, [remove]);

        // Nothing may remain: replaying the add would resurrect the row the caller deleted
        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('a confirmed change leaves alone edits enqueued after it', async () => {
        const add: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [add]);

        // A newer local edit of a different kind lands while the add is in flight
        const update: QueuedChange = { kind: 'update', entity: { id: 'e1', name: 'v2' } };
        await queue.addMany(testSchema as never, [update]);

        await queue.removeMany(testSchema as never, [add]);

        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(rows[0].changeKind).toBe('update');
    });

    it('a row overwritten while flushing survives the flush being confirmed', async () => {
        const first: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [first]);

        // The flush reads the rows it is about to POST...
        const payload = await queue.getUnsyncedEntitiesForFlush('swrHardening');

        // ...and a newer edit replaces one of them before the POST is confirmed
        const second: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v2' } };
        await queue.addMany(testSchema as never, [second]);

        await queue.removeRows(payload.rows);

        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(JSON.parse(rows[0].entityJson)).toEqual({ id: 'e1', name: 'v2' });
    });

    it('still dequeues rows written before revisions existed', async () => {
        const change: QueuedChange = { kind: 'add', entity: { id: 'legacy', name: 'Old' } };
        await queue.addMany(testSchema as never, [change]);

        await queue.removeMany(testSchema as never, [{ kind: 'add', entity: { id: 'legacy', name: 'Old' } }]);

        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('a write that lands mid-POST survives the in-flight POST being confirmed', async () => {
        const http = installFetchMock();
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 1,
        });

        // The first POST is slow and succeeds; the second fails, so only the first dequeues
        http.respondToPost((call) => {
            const body = call.body as { adds: Array<{ name: string }> };
            return body.adds[0]?.name === 'v1'
                ? { status: 200, body: {}, delayMs: 150 }
                : { status: 500 };
        });

        const firstPersist = persistPlugin(plugin, { adds: [{ id: 'e1', name: 'v1' }] });
        await waitFor(() => http.posts.length === 1, 'the first POST to be in flight');

        await persistPlugin(plugin, { adds: [{ id: 'e1', name: 'v2' }] });
        await firstPersist;
        await sleep(50);

        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(JSON.parse(rows[0].entityJson)).toEqual(expect.objectContaining({ name: 'v2' }));

        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
    });
});

describe('hardening: re-auth handshake', () => {
    let http: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
        http = installFetchMock();
    });

    it('query: a handler that resolves true earns exactly one retry with fresh headers', async () => {
        let token = 'stale';
        const getHeaders = jest.fn(() => ({ Authorization: token }));
        const onAuthError = jest.fn(async () => { token = 'fresh'; return true; });

        http.respondToGet(() => (token === 'fresh' ? { status: 200, body: [{ id: 'a', name: 'Alice' }] } : { status: 401 }));

        const plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            getHeaders,
            onAuthError,
            queryRetryMaxAttempts: 1,
        });

        const rows = await queryPlugin(plugin);

        expect(rows).toHaveLength(1);
        expect(http.gets).toHaveLength(2);
        expect(getHeaders).toHaveBeenCalledTimes(2);
        expect(http.gets[0].headers.Authorization).toBe('stale');
        expect(http.gets[1].headers.Authorization).toBe('fresh');
        expect(onAuthError).toHaveBeenCalledTimes(1);
    });

    it('query: a handler that returns nothing does not earn a retry', async () => {
        const onAuthError = jest.fn(() => undefined);
        http.respondToGet(() => ({ status: 401 }));

        const plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            onAuthError,
            queryRetryMaxAttempts: 3,
        });

        await expect(queryPlugin(plugin)).rejects.toThrow('HTTP 401');
        expect(http.gets).toHaveLength(1);
        expect(onAuthError).toHaveBeenCalledTimes(1);
    });

    it('query: re-auth is offered only once, however many 401s follow', async () => {
        const onAuthError = jest.fn(async () => true);
        http.respondToGet(() => ({ status: 401 }));

        const plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            onAuthError,
            queryRetryMaxAttempts: 1,
        });

        await expect(queryPlugin(plugin)).rejects.toThrow('HTTP 401');
        expect(http.gets).toHaveLength(2);
    });

    it('POST: a successful re-auth retries the persist once with fresh headers', async () => {
        let token = 'stale';
        const getHeaders = jest.fn(() => ({ Authorization: token }));
        const onAuthError = jest.fn(async () => { token = 'fresh'; return true; });
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);

        http.respondToPost(() => (token === 'fresh' ? { status: 200, body: {} } : { status: 401 }));

        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            getHeaders,
            onAuthError,
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 1,
        });

        await persistPlugin(plugin, { adds: [{ id: 'p1', name: 'Needs auth' }] });
        // Waiting on the event rather than a fixed delay: successive POSTs to one collection are
        // paced now, so the retry lands later than it used to
        await waitFor(() => http.posts.length === 2, 'the re-auth retry to go out');

        expect(http.posts).toHaveLength(2);
        expect(http.posts[0].headers.Authorization).toBe('stale');
        expect(http.posts[1].headers.Authorization).toBe('fresh');
        // The retry succeeded, so nothing is left queued
        await waitForRowCount(queueStore, 0, queueMirrorSchema);

        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
    });
});

describe('hardening: request timeouts and destroy aborts', () => {
    let http: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
        http = installFetchMock();
    });

    it('a request that never answers fails once requestTimeoutMs elapses', async () => {
        http.respondToGet(() => ({ status: 200, hang: true }));

        const plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            requestTimeoutMs: 50,
        });

        const started = Date.now();
        await expect(queryPlugin(plugin)).rejects.toThrow('Request timed out after 50ms');
        expect(Date.now() - started).toBeLessThan(2000);
    });

    it('destroy aborts an in-flight request and refuses new ones', async () => {
        http.respondToGet(() => ({ status: 200, hang: true }));

        const plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            requestTimeoutMs: 0,
        });

        const inFlight = queryPlugin(plugin);
        await waitFor(() => http.gets.length === 1, 'the query to reach the network');

        plugin.destroy(destroyEvent(), () => undefined);

        await expect(inFlight).rejects.toThrow('Plugin destroyed');
        await expect(queryPlugin(plugin)).rejects.toThrow('Plugin destroyed; request not sent');
        expect(http.gets).toHaveLength(1);
    });

    it('a timed-out cache-miss falls back to the SWR store instead of failing the read', async () => {
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        http.respondToGet(() => ({ status: 200, hang: true }));

        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            requestTimeoutMs: 50,
            bulkPersistRetryBaseDelayMs: 60_000,
        });

        await expect(queryPlugin(plugin)).resolves.toHaveLength(0);

        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
    });
});

describe('hardening: PluginSyncEngine call guards', () => {
    function hungPlugin() {
        return {
            query: jest.fn(() => undefined),
            bulkPersist: jest.fn(() => undefined),
            destroy: jest.fn((_event: unknown, cb: (r: unknown) => void) => cb({ ok: Result.SUCCESS })),
        } as never;
    }

    it('a plugin that never calls done() fails the call after pluginCallTimeoutMs', async () => {
        const engine = new PluginSyncEngine({ source: hungPlugin(), pluginCallTimeoutMs: 30 });

        const result = await new Promise<{ ok: string; error?: Error }>((resolve) => {
            engine.query(createQueryEvent() as never, (r) => resolve(r as never));
        });

        expect(result.ok).toBe(Result.ERROR);
        expect(String(result.error)).toContain('did not complete within 30ms');
    });

    it('a plugin that calls done() twice settles the engine exactly once', async () => {
        const twiceCalling = {
            query: jest.fn((_event: unknown, cb: (r: unknown) => void) => {
                cb({ ok: Result.SUCCESS, data: translated([{ id: 'a', name: 'A' }]) });
                cb({ ok: Result.ERROR, error: new Error('second done') });
            }),
            bulkPersist: jest.fn(),
            destroy: jest.fn(),
        } as never;

        const engine = new PluginSyncEngine({ source: twiceCalling });

        let calls = 0;
        let last: { ok: string } | null = null;
        engine.query(createQueryEvent() as never, (r) => { calls++; last = r as never; });

        await sleep(30);
        expect(calls).toBe(1);
        expect(last!.ok).toBe(Result.SUCCESS);
    });

    it('pluginCallTimeoutMs=0 disables the timeout', async () => {
        let release: (() => void) | null = null;
        const slow = {
            query: jest.fn((_event: unknown, cb: (r: unknown) => void) => {
                release = () => cb({ ok: Result.SUCCESS, data: translated([]) });
            }),
            bulkPersist: jest.fn(),
            destroy: jest.fn(),
        } as never;

        const engine = new PluginSyncEngine({ source: slow, pluginCallTimeoutMs: 0 });

        const settled = new Promise<{ ok: string }>((resolve) => {
            engine.query(createQueryEvent() as never, (r) => resolve(r as never));
        });

        await sleep(60);
        release!();
        expect((await settled).ok).toBe(Result.SUCCESS);
    });
});

describe('hardening: backoff, Retry-After and status classification', () => {
    it('jittered backoff stays between half the capped delay and the cap', () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const capped = Math.min(100 * Math.pow(2, attempt), 5_000);
            for (let i = 0; i < 50; i++) {
                const delay = backoffDelayMs(attempt, 100, 5_000);
                expect(delay).toBeGreaterThanOrEqual(capped / 2);
                expect(delay).toBeLessThan(capped);
            }
        }
    });

    it('spreads the jitter across the whole upper half, not just its floor', () => {
        // Bounds alone would accept a "jitter" term that is always ~0 — which is no jitter at
        // all, and the point of the equal-jitter scheme is that a fleet does not retry in step
        const capped = 8_000;
        const samples = Array.from({ length: 200 }, () => backoffDelayMs(3, 1_000, capped));

        expect(Math.max(...samples)).toBeGreaterThan(capped * 0.9);
        expect(Math.min(...samples)).toBeLessThan(capped * 0.6);
    });

    it('an explicit Retry-After overrides the computed delay, still capped', () => {
        expect(backoffDelayMs(3, 1_000, 60_000, 250)).toBe(250);
        expect(backoffDelayMs(0, 1_000, 5_000, 999_999)).toBe(5_000);
    });

    it('reads Retry-After as seconds or as an HTTP date', () => {
        const headers = (value: string | null) => ({ headers: { get: () => value } });

        expect(readRetryAfterMs(headers('2'))).toBe(2_000);
        expect(readRetryAfterMs(headers(null))).toBeNull();
        expect(readRetryAfterMs(headers('not-a-date'))).toBeNull();
        // "retry immediately" is a real answer and must not read as "no header"
        expect(readRetryAfterMs(headers('0'))).toBe(0);
        // A negative delay is nonsense, not a delay: fall through rather than schedule the past
        expect(readRetryAfterMs(headers('-5'))).toBeNull();

        const inFive = new Date(Date.now() + 5_000).toUTCString();
        const fromDate = readRetryAfterMs(headers(inFive));
        expect(fromDate).toBeGreaterThan(3_000);
        expect(fromDate).toBeLessThanOrEqual(6_000);
    });

    it('tolerates responses without headers or without a header getter', () => {
        // Mock responses and some runtimes hand back either shape; reading Retry-After must
        // never be the thing that turns a retryable failure into a thrown TypeError
        expect(readRetryAfterMs({})).toBeNull();
        expect(readRetryAfterMs({ headers: {} })).toBeNull();
    });

    it('classifies only non-auth, non-throttle 4xx as permanent', () => {
        expect([400, 404, 409, 422].map(isPermanentStatus)).toEqual([true, true, true, true]);
        expect([401, 403, 408, 429, 500, 503, 200, 302].map(isPermanentStatus)).toEqual(
            [false, false, false, false, false, false, false, false]
        );
    });

    it('recognizes exactly the auth and conflict statuses', () => {
        expect([401, 403].map(isAuthStatus)).toEqual([true, true]);
        expect([400, 404, 409, 429, 500].map(isAuthStatus)).toEqual([false, false, false, false, false]);

        expect(isConflictStatus(409)).toBe(true);
        expect([400, 401, 412, 422, 500].map(isConflictStatus)).toEqual([false, false, false, false, false]);
    });
});

describe('hardening: KeyedMutex serializes per key', () => {
    it('never lets two holders of the same key overlap', async () => {
        const mutex = new KeyedMutex();
        let concurrent = 0;
        let maxConcurrent = 0;
        const order: number[] = [];

        await Promise.all(Array.from({ length: 20 }, (_, i) => mutex.run('same-key', async () => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            // Yield across several turns: a mutex that only appears to work because nothing
            // awaits inside the critical section is not a mutex
            await sleep(1);
            await Promise.resolve();
            order.push(i);
            concurrent--;
        })));

        expect(maxConcurrent).toBe(1);
        // Arrival order, since each caller queues behind the tail it found
        expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
    });

    it('lets different keys run concurrently', async () => {
        const mutex = new KeyedMutex();
        let inFlight = 0;
        let peak = 0;

        await Promise.all(['a', 'b', 'c'].map((key) => mutex.run(key, async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await sleep(5);
            inFlight--;
        })));

        expect(peak).toBe(3);
    });

    it('drops a key once nothing is queued behind it, so the map cannot grow forever', async () => {
        const mutex = new KeyedMutex();
        const tails = (mutex as never as { tails: Map<string, unknown> }).tails;

        await Promise.all([
            mutex.run('a', async () => { await sleep(1); }),
            mutex.run('a', async () => { await sleep(1); }),
            mutex.run('b', async () => { await sleep(1); }),
        ]);

        expect(tails.size).toBe(0);
    });

    it('keeps the key registered while a later holder still owns it', async () => {
        // The cleanup must drop the key only when the tail is still the one this caller
        // installed. Dropping it unconditionally looks harmless — the already-linked waiters
        // still run in order — but a caller arriving afterwards finds no tail, starts a fresh
        // chain, and runs straight through the lock a queued holder is inside.
        const mutex = new KeyedMutex();
        const gates = { first: () => { }, second: () => { } };
        const first = new Promise<void>((resolve) => { gates.first = resolve; });
        const second = new Promise<void>((resolve) => { gates.second = resolve; });
        const entered: string[] = [];

        const runFirst = mutex.run('k', async () => { entered.push('first'); await first; });
        const runSecond = mutex.run('k', async () => { entered.push('second'); await second; });

        await settleMicrotasks();
        expect(entered).toEqual(['first']);

        // The first holder releases; the second is now inside the lock
        gates.first();
        await runFirst;
        await settleMicrotasks();
        expect(entered).toEqual(['first', 'second']);

        // A third caller arrives now — it must wait for the second, not barge in
        const runThird = mutex.run('k', async () => { entered.push('third'); });
        await settleMicrotasks();
        expect(entered).toEqual(['first', 'second']);

        gates.second();
        await Promise.all([runSecond, runThird]);
        expect(entered).toEqual(['first', 'second', 'third']);
    });

    it('propagates the failure of a locked section and still releases the lock', async () => {
        const mutex = new KeyedMutex();

        await expect(mutex.run('k', async () => { throw new Error('inside'); })).rejects.toThrow('inside');

        // A lock stuck held would deadlock every later write to that collection
        await expect(mutex.run('k', async () => 'after')).resolves.toBe('after');
        expect((mutex as never as { tails: Map<string, unknown> }).tails.size).toBe(0);
    });

    it('honors Retry-After instead of the configured backoff when retrying a POST', async () => {
        const http = installFetchMock();
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);

        let posts = 0;
        http.respondToPost(() => (++posts === 1
            ? { status: 503, headers: { 'Retry-After': '0' } }
            : { status: 200, body: {} }));

        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            // Without Retry-After this backoff would push the retry ~30s out
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 2,
        });

        const started = Date.now();
        await persistPlugin(plugin, { adds: [{ id: 'ra-1', name: 'Throttled' }] });
        await waitFor(() => http.posts.length === 2, 'the Retry-After retry');
        expect(Date.now() - started).toBeLessThan(2_000);

        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
    });
});

describe('hardening: POST-echo reconciliation', () => {
    it('upserts the entities the server echoed and notifies subscribers', async () => {
        const http = installFetchMock();
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);

        http.respondToPost(() => ({ status: 200, body: { saved: [{ id: 'local-1', name: 'Canonical from server' }] } }));

        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 1,
            translatePersistResponse: (_schema, body) => (body as { saved?: unknown[] }).saved ?? null,
        });

        // A separate subscription observes what the plugin broadcasts
        const observed: unknown[] = [];
        // Scoped to the plugin's database: the plugin broadcasts on `schema|databaseName`,
        // so an unscoped observer sits on a channel nothing is sent to.
        const subscription: ISchemaSubscription<Record<string, unknown>> = (testSchema as never as {
            createSubscription: (signal?: AbortSignal, scope?: string) => ISchemaSubscription<Record<string, unknown>>;
        }).createSubscription(undefined, plugin.databaseName);
        subscription.onMessage((changes) => observed.push(changes));

        await persistPlugin(plugin, { adds: [{ id: 'local-1', name: 'Optimistic' }] });

        await waitFor(async () => {
            const rows = await queryPlugin(swrStore) as Array<{ name: string }>;
            return rows.length === 1 && rows[0].name === 'Canonical from server';
        }, 'the echoed entity to reach the store');

        await waitFor(() => observed.length > 0, 'a subscription notification');

        subscription[Symbol.dispose]();
        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
    });

    it('leaves the store alone when the translator returns null', async () => {
        const http = installFetchMock();
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);

        http.respondToPost(() => ({ status: 200, body: { saved: [{ id: 'x', name: 'Ignored' }] } }));

        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 1,
            translatePersistResponse: () => null,
        });

        await persistPlugin(plugin, { adds: [{ id: 'local-2', name: 'Optimistic' }] });
        await sleep(50);

        const rows = await queryPlugin(swrStore) as Array<{ id: string; name: string }>;
        expect(rows).toEqual([expect.objectContaining({ id: 'local-2', name: 'Optimistic' })]);

        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
    });
});

describe('hardening: online event triggers an immediate flush', () => {
    const globals = globalThis as unknown as {
        addEventListener?: EventTarget['addEventListener'];
        removeEventListener?: EventTarget['removeEventListener'];
        dispatchEvent?: EventTarget['dispatchEvent'];
    };
    let saved: Pick<typeof globals, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

    beforeEach(() => {
        // Node has no window-style event target on globalThis, so stand one in —
        // this is the browser wiring the plugin depends on.
        saved = {
            addEventListener: globals.addEventListener,
            removeEventListener: globals.removeEventListener,
            dispatchEvent: globals.dispatchEvent,
        };
        const target = new EventTarget();
        globals.addEventListener = target.addEventListener.bind(target);
        globals.removeEventListener = target.removeEventListener.bind(target);
        globals.dispatchEvent = target.dispatchEvent.bind(target);
    });

    afterEach(() => {
        globals.addEventListener = saved.addEventListener;
        globals.removeEventListener = saved.removeEventListener;
        globals.dispatchEvent = saved.dispatchEvent;
    });

    it('flushes queued changes on `online`, and stops listening after destroy', async () => {
        const http = installFetchMock();
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);

        http.respondToPost(() => ({ status: 500 }));

        const plugin = new HttpSwrDbPlugin(swrStore, {
            // Auto-sync stays ON — the `online` listener is the subject here. The long delay
            // keeps the *timer* out of the way so only the event can explain a flush.
            autoSync: { delayMs: 60_000, onOnline: true },
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryMaxAttempts: 1,
        });

        await persistPlugin(plugin, { adds: [{ id: 'off-1', name: 'Written offline' }] });
        expect(await readQueueRows(queueStore)).toHaveLength(1);

        // Connectivity returns
        http.respondToPost(() => ({ status: 200, body: {} }));
        globals.dispatchEvent!(new Event('online'));

        await waitForRowCount(queueStore, 0, queueMirrorSchema);

        // After destroy the listener is gone: a later `online` must not fire a flush
        await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
        const postsAfterDestroy = http.posts.length;
        globals.dispatchEvent!(new Event('online'));
        await sleep(50);
        expect(http.posts).toHaveLength(postsAfterDestroy);
    });
});

describe('hardening: queue coalescing', () => {
    let queueStore: MemoryPlugin;
    let queue: UnsyncedQueue;

    beforeEach(() => {
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        queue = new UnsyncedQueue(queueStore);
    });

    it('a remove supersedes a pending add of the same entity', async () => {
        await queue.add(testSchema as never, { id: 'e1', name: 'Created' }, 'add');
        await queue.add(testSchema as never, { id: 'e1', name: 'Created' }, 'remove');

        const payload = await queue.getUnsyncedEntitiesForFlush('swrHardening');

        expect(payload.adds).toHaveLength(0);
        expect(payload.updates).toHaveLength(0);
        expect(payload.removes).toEqual([expect.objectContaining({ id: 'e1' })]);
        expect(payload.units).toHaveLength(1);
        // Both rows settle together when the POST succeeds
        expect(payload.rows).toHaveLength(2);
        expect(payload.opIds.removes).toHaveLength(1);
    });

    it('an add followed by an update flushes one add carrying the newer entity', async () => {
        const add: QueuedChange = { kind: 'add', entity: { id: 'e2', name: 'First' } };
        const update: QueuedChange = { kind: 'update', entity: { id: 'e2', name: 'Second' } };
        await queue.addMany(testSchema as never, [add]);
        await queue.addMany(testSchema as never, [update]);

        const payload = await queue.getUnsyncedEntitiesForFlush('swrHardening');

        expect(payload.updates).toHaveLength(0);
        expect(payload.adds).toEqual([expect.objectContaining({ name: 'Second' })]);
        expect(payload.rows).toHaveLength(2);
        // The opId must describe the entity actually sent. Reusing the add's opId would let a
        // server that already applied it dedupe the replay and silently drop the newer entity.
        expect(payload.opIds.adds).toEqual([update.opId]);
        expect(payload.opIds.adds).not.toEqual([add.opId]);
    });

    it('excludes dead rows from flush, from collections, and from shielding', async () => {
        await queue.add(testSchema as never, { id: 'alive', name: 'Alive' }, 'add');
        await queue.add(testSchema as never, { id: 'gone', name: 'Gone' }, 'add');

        const rows = await readQueueRows(queueStore);
        const doomed = rows.filter((r) => r.recordIds.includes('gone'));
        expect(doomed).toHaveLength(1);
        const reported = await queue.deadLetter(doomed as never);

        expect(reported).toEqual([
            expect.objectContaining({ collectionName: 'swrHardening', kind: 'add', entity: expect.objectContaining({ id: 'gone' }) }),
        ]);
        expect(await queue.getPendingCount()).toBe(1);
        expect(await queue.getDeadLetters()).toHaveLength(1);
        expect(await queue.getUnsyncedCollections()).toEqual(['swrHardening']);

        const payload = await queue.getUnsyncedEntitiesForFlush('swrHardening');
        expect(payload.adds).toEqual([expect.objectContaining({ id: 'alive' })]);

        const shielded = await queue.getUnsyncedIdKeys('swrHardening');
        expect(shielded.size).toBe(1);
    });

    it('treats rows written before changeKind existed as adds', async () => {
        // A row in the pre-hardening shape: no changeKind, no revision, no opId, no status
        await writeQueueRows(queueStore, [{
            // Row ids are NUL-delimited: `${collection}\u0000${kind}\u0000${recordIds}`
            id: ['swrHardening', 'add', '["legacy"]'].join('\u0000'),
            collectionName: 'swrHardening',
            recordIds: '["legacy"]',
            entityJson: JSON.stringify({ id: 'legacy', name: 'Old' }),
        }]);

        const payload = await queue.getUnsyncedEntitiesForFlush('swrHardening');

        expect(payload.adds).toEqual([expect.objectContaining({ id: 'legacy' })]);
        expect(payload.opIds.adds).toEqual(['']);
        // Missing status must not read as dead — a legacy row still shields its entity
        expect(await queue.getPendingCount()).toBe(1);
        expect((await queue.getUnsyncedIdKeys('swrHardening')).size).toBe(1);
    });
});

describe('sync: automatic by default, overridable when it matters', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    function createPlugin(options?: SwrOptions) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryMaxAttempts: 1,
            writeBatchDelayMs: 0,
            ...options,
        });
        created.push(plugin);
        return plugin;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
    });

    it('replays a queued change on its own, with no help from the caller', async () => {
        http.respondToPost(() => ({ status: 500 }));
        // A short cadence is the whole configuration needed to see the automatic behaviour
        const plugin = createPlugin({ autoSync: { delayMs: 20 } });

        await persistPlugin(plugin, { adds: [{ id: 'auto-1', name: 'Queued' }] });
        expect(await plugin.pendingCount()).toBe(1);

        // Nothing below calls syncNow(): the background loop is the only thing that can drain this
        http.respondToPost(() => ({ status: 200, body: {} }));
        await waitFor(async () => (await plugin.pendingCount()) === 0, 'the background loop to drain the queue');
    });

    it('autoSync: false queues durably but replays nothing until asked', async () => {
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin({ autoSync: false, bulkPersistRetryBaseDelayMs: 1 });

        await persistPlugin(plugin, { adds: [{ id: 'manual-1', name: 'Queued' }] });
        expect(await plugin.pendingCount()).toBe(1);

        // Turning the loop off must not turn off the obligation: a tiny retry delay would have
        // drained this within the wait if any timer were still running
        http.respondToPost(() => ({ status: 200, body: {} }));
        const postsBefore = http.posts.length;
        await sleep(120);
        expect(http.posts).toHaveLength(postsBefore);
        expect(await plugin.pendingCount()).toBe(1);

        // ...and the caller can still drain it whenever it likes
        expect(await plugin.syncNow()).toEqual({ flushed: 1, failed: 0, deadLettered: 0 });
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('autoSync: false also silences the online trigger', async () => {
        const target = new EventTarget();
        const globals = globalThis as unknown as Record<string, unknown>;
        const saved = { add: globals.addEventListener, remove: globals.removeEventListener };
        globals.addEventListener = target.addEventListener.bind(target);
        globals.removeEventListener = target.removeEventListener.bind(target);

        try {
            http.respondToPost(() => ({ status: 500 }));
            const plugin = createPlugin({ autoSync: false });
            await persistPlugin(plugin, { adds: [{ id: 'off-1', name: 'Queued' }] });

            http.respondToPost(() => ({ status: 200, body: {} }));
            const postsBefore = http.posts.length;
            target.dispatchEvent(new Event('online'));
            await sleep(50);

            expect(http.posts).toHaveLength(postsBefore);
            expect(await plugin.pendingCount()).toBe(1);
        } finally {
            globals.addEventListener = saved.add;
            globals.removeEventListener = saved.remove;
        }
    });

    it('onOnline: false keeps the timer but drops the connectivity listener', async () => {
        const target = new EventTarget();
        const globals = globalThis as unknown as Record<string, unknown>;
        const saved = { add: globals.addEventListener, remove: globals.removeEventListener };
        globals.addEventListener = target.addEventListener.bind(target);
        globals.removeEventListener = target.removeEventListener.bind(target);

        try {
            http.respondToPost(() => ({ status: 500 }));
            const plugin = createPlugin({ autoSync: { delayMs: 60_000, onOnline: false } });
            await persistPlugin(plugin, { adds: [{ id: 'no-online', name: 'Queued' }] });

            http.respondToPost(() => ({ status: 200, body: {} }));
            target.dispatchEvent(new Event('online'));
            await sleep(50);

            expect(await plugin.pendingCount()).toBe(1);
        } finally {
            globals.addEventListener = saved.add;
            globals.removeEventListener = saved.remove;
        }
    });

    it('reports every flush through onSync, manual or automatic', async () => {
        const outcomes: SyncOutcome[] = [];
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin({ autoSync: false, onSync: (outcome) => { outcomes.push(outcome); } });

        await persistPlugin(plugin, { adds: [{ id: 's-1', name: 'Queued' }] });
        await plugin.syncNow();
        expect(outcomes).toEqual([{ flushed: 0, failed: 1, deadLettered: 0 }]);

        http.respondToPost(() => ({ status: 200, body: {} }));
        await plugin.syncNow();
        expect(outcomes[1]).toEqual({ flushed: 1, failed: 0, deadLettered: 0 });

        // An empty flush still reports, so a "last synced" indicator keeps moving
        await plugin.syncNow();
        expect(outcomes[2]).toEqual({ flushed: 0, failed: 0, deadLettered: 0 });
    });

    it('a throwing onSync cannot break the flush', async () => {
        // The write has to fail first, or the direct POST syncs it and the flush has no work
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin({ autoSync: false, onSync: () => { throw new Error('bad listener'); } });

        await persistPlugin(plugin, { adds: [{ id: 'thrower', name: 'Queued' }] });

        http.respondToPost(() => ({ status: 200, body: {} }));
        await expect(plugin.syncNow()).resolves.toEqual({ flushed: 1, failed: 0, deadLettered: 0 });
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('exposes dead letters and can retry them once the cause is fixed', async () => {
        // 422 is permanent: the flush isolates the change and gives up on it
        http.respondToPost(() => ({ status: 422 }));
        const deadLettered: DeadLetteredChange[] = [];
        const plugin = createPlugin({ autoSync: false, onSyncDeadLetter: (changes) => deadLettered.push(...changes) });

        await persistPlugin(plugin, { adds: [{ id: 'rejected', name: 'Bad record' }] });
        expect(await plugin.syncNow()).toEqual({ flushed: 0, failed: 0, deadLettered: 1 });

        expect(await plugin.pendingCount()).toBe(0);
        const dead = await plugin.deadLetters();
        expect(dead).toHaveLength(1);
        expect(JSON.parse(dead[0].entityJson)).toEqual(expect.objectContaining({ id: 'rejected' }));
        expect(deadLettered).toHaveLength(1);

        // Nothing retries a dead letter on its own — the server said it cannot work
        const postsBefore = http.posts.length;
        await plugin.syncNow();
        expect(http.posts).toHaveLength(postsBefore);

        // The cause is fixed (a deploy, a corrected record): now an explicit retry gets through
        http.respondToPost(() => ({ status: 200, body: {} }));
        const retried = await plugin.retryDeadLetters();

        expect(retried).toEqual({ revived: 1, outcome: { flushed: 1, failed: 0, deadLettered: 0 } });
        expect(await plugin.deadLetters()).toHaveLength(0);
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('retryDeadLetters is a no-op when there is nothing to revive', async () => {
        const plugin = createPlugin({ autoSync: false });

        expect(await plugin.retryDeadLetters()).toEqual({
            revived: 0,
            outcome: { flushed: 0, failed: 0, deadLettered: 0 },
        });
    });

    it('a retried dead letter that fails again dead-letters again', async () => {
        http.respondToPost(() => ({ status: 422 }));
        const plugin = createPlugin({ autoSync: false });

        await persistPlugin(plugin, { adds: [{ id: 'still-bad', name: 'Bad record' }] });
        await plugin.syncNow();
        expect(await plugin.deadLetters()).toHaveLength(1);

        const retried = await plugin.retryDeadLetters();

        expect(retried.revived).toBe(1);
        expect(retried.outcome).toEqual({ flushed: 0, failed: 0, deadLettered: 1 });
        expect(await plugin.deadLetters()).toHaveLength(1);
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('pendingCount counts what is waiting, across collections', async () => {
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin({ autoSync: false });

        expect(await plugin.pendingCount()).toBe(0);

        await persistPlugin(plugin, { adds: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }] });
        expect(await plugin.pendingCount()).toBe(2);

        http.respondToPost(() => ({ status: 200, body: {} }));
        await plugin.syncNow();
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('keeps the old bulkPersistRetryBaseDelayMs cadence when no autoSync is given', async () => {
        // Back-compat: that option used to double as the background flush delay, and existing
        // configurations depend on it. Setting it far out must still hold the loop off.
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin({ bulkPersistRetryBaseDelayMs: 60_000 });

        await persistPlugin(plugin, { adds: [{ id: 'legacy-cadence', name: 'Queued' }] });
        http.respondToPost(() => ({ status: 200, body: {} }));
        const postsBefore = http.posts.length;
        await sleep(120);

        expect(http.posts).toHaveLength(postsBefore);
        expect(await plugin.pendingCount()).toBe(1);
    });
});

describe('sync: flushes are single-flight so the app cannot flood its own server', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    function createPlugin(options?: SwrOptions) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            bulkPersistRetryMaxAttempts: 1,
            ...options,
        });
        created.push(plugin);
        return plugin;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
    });

    /** Queues one change by failing its direct POST, then lets the server accept from now on. */
    async function queueOneChange(plugin: HttpSwrDbPlugin, id: string) {
        http.respondToPost(() => ({ status: 500 }));
        await persistPlugin(plugin, { adds: [{ id, name: 'Queued' }] });
        http.respondToPost(() => ({ status: 200, body: {}, delayMs: 40 }));
    }

    it('two concurrent syncNow calls produce one round of requests', async () => {
        const plugin = createPlugin({ autoSync: false });
        await queueOneChange(plugin, 'c-1');
        const postsBefore = http.posts.length;

        // The double-clicked button
        const [first, second] = await Promise.all([plugin.syncNow(), plugin.syncNow()]);

        // One flush moved the change; the follow-up found an empty queue. Between them they
        // sent exactly one POST — before the guard, both would have sent the same row.
        expect(first.flushed + second.flushed).toBe(1);
        expect(http.posts.length - postsBefore).toBe(1);
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('a burst of triggers collapses into at most two flushes', async () => {
        const plugin = createPlugin({ autoSync: false });
        await queueOneChange(plugin, 'c-2');
        const postsBefore = http.posts.length;

        const outcomes = await Promise.all(Array.from({ length: 8 }, () => plugin.syncNow()));

        expect(outcomes.reduce((sum, o) => sum + o.flushed, 0)).toBe(1);
        // The running flush plus one shared follow-up — never eight
        expect(http.posts.length - postsBefore).toBeLessThanOrEqual(1);
    });

    it('a caller arriving mid-flush still gets its own change delivered', async () => {
        // The reason mid-flush callers are not simply handed the running promise: this write
        // lands after that flush has already read the queue, so joining it would report success
        // for a change that never left.
        const plugin = createPlugin({ autoSync: false });
        await queueOneChange(plugin, 'first');

        const running = plugin.syncNow();
        await sleep(10);

        http.respondToPost(() => ({ status: 500 }));
        await persistPlugin(plugin, { adds: [{ id: 'second', name: 'Later' }] });
        http.respondToPost(() => ({ status: 200, body: {} }));

        const followUp = plugin.syncNow();
        await Promise.all([running, followUp]);

        expect(await plugin.pendingCount()).toBe(0);
    });

    it('the background timer and a manual flush never overlap', async () => {
        // A tight cadence plus a manual flush is the collision that used to double the traffic
        const plugin = createPlugin({ autoSync: { delayMs: 5, minIntervalMs: 0 } });
        http.respondToPost(() => ({ status: 500 }));
        await persistPlugin(plugin, { adds: [{ id: 'overlap', name: 'Queued' }] });

        let concurrent = 0;
        let maxConcurrent = 0;
        http.respondToPost(() => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            return { status: 200, body: {}, delayMs: 30 };
        });
        // The mock resolves after delayMs, so decrement once the response has been produced
        const settle = setInterval(() => { concurrent = 0; }, 200);

        await Promise.all([plugin.syncNow(), plugin.syncNow(), sleep(80)]);
        clearInterval(settle);

        expect(maxConcurrent).toBe(1);
    });

    it('minIntervalMs spaces out automatic flushes', async () => {
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin({ autoSync: { delayMs: 5, minIntervalMs: 120 } });
        await persistPlugin(plugin, { adds: [{ id: 'spaced', name: 'Queued' }] });

        const postsAfterPersist = http.posts.length;
        // A 5ms cadence would fire ~20 times in 100ms; the interval holds it to about one
        await sleep(100);

        expect(http.posts.length - postsAfterPersist).toBeLessThanOrEqual(2);
    });

    it('does not apply the interval when the caller drives sync themselves', async () => {
        const plugin = createPlugin({ autoSync: false });
        http.respondToPost(() => ({ status: 200, body: {} }));

        const started = Date.now();
        await plugin.syncNow();
        await plugin.syncNow();
        await plugin.syncNow();

        // autoSync: false means no hidden delays — three sequential flushes are immediate
        expect(Date.now() - started).toBeLessThan(150);
    });
});

describe('sync: an update sends keys plus what changed', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    function createPlugin(options?: SwrOptions) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            autoSync: false,
            bulkPersistRetryMaxAttempts: 1,
            writeBatchDelayMs: 0,
            ...options,
        });
        created.push(plugin);
        return plugin;
    }

    const lastPostBody = () => http.posts[http.posts.length - 1].body as {
        adds: unknown[];
        updates: Array<Record<string, unknown>>;
        removes: unknown[];
    };

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        http.respondToPost(() => ({ status: 200, body: {} }));
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
    });

    it('sends the key and the changed field, not the whole row', async () => {
        const plugin = createPlugin();

        await persistPlugin(plugin, {
            updatesWithDelta: [{ entity: { id: 'e1', name: 'Renamed' }, delta: { name: 'Renamed' } }],
        });

        expect(lastPostBody().updates).toEqual([{ id: 'e1', name: 'Renamed' }]);
    });

    it('omits fields that did not change', async () => {
        // A wide row where one column moved: the body should not carry the rest
        const wideSchema = s.define('wideRows', {
            id: s.string().key().identity(),
            name: s.string(),
            price: s.number(),
            note: s.string().optional(),
        }).compile();
        const plugin = createPlugin();

        await persistPlugin(plugin, {
            updatesWithDelta: [{
                entity: { id: 'w1', name: 'Widget', price: 42, note: 'unchanged' },
                delta: { price: 42 },
            }],
        }, wideSchema);

        expect(lastPostBody().updates).toEqual([{ id: 'w1', price: 42 }]);
    });

    it('falls back to the whole entity when nothing says which fields changed', async () => {
        // An empty delta is core's "no tracked change list" convention, not "nothing changed".
        // Sending keys alone would be a well-formed update that silently drops the edit.
        const plugin = createPlugin();

        await persistPlugin(plugin, { updates: [{ id: 'e2', name: 'Whole entity' }] });

        expect(lastPostBody().updates).toEqual([{ id: 'e2', name: 'Whole entity' }]);
    });

    it('replays the same trimmed body after a failure', async () => {
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin();

        await persistPlugin(plugin, {
            updatesWithDelta: [{ entity: { id: 'e3', name: 'Renamed' }, delta: { name: 'Renamed' } }],
        });
        expect(await plugin.pendingCount()).toBe(1);

        // The delta is long gone by flush time — the queue has to have kept the body
        http.respondToPost(() => ({ status: 200, body: {} }));
        expect(await plugin.syncNow()).toEqual({ flushed: 1, failed: 0, deadLettered: 0 });

        expect(lastPostBody().updates).toEqual([{ id: 'e3', name: 'Renamed' }]);
    });

    it('merges the fields of two queued updates to the same row', async () => {
        // Rows are keyed by (collection, kind, ids), so the second update replaces the first.
        // Without merging, the first field change would never reach the server.
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin();

        await persistPlugin(plugin, {
            updatesWithDelta: [{ entity: { id: 'e4', name: 'Renamed', price: 1 }, delta: { name: 'Renamed' } }],
        });
        await persistPlugin(plugin, {
            updatesWithDelta: [{ entity: { id: 'e4', name: 'Renamed', price: 99 }, delta: { price: 99 } }],
        });

        http.respondToPost(() => ({ status: 200, body: {} }));
        await plugin.syncNow();

        expect(lastPostBody().updates).toEqual([{ id: 'e4', name: 'Renamed', price: 99 }]);
    });

    it('a whole-entity update absorbs a partial one', async () => {
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin();

        await persistPlugin(plugin, {
            updatesWithDelta: [{ entity: { id: 'e5', name: 'Partial' }, delta: { name: 'Partial' } }],
        });
        // No delta: this one means "write everything", which subsumes the field above
        await persistPlugin(plugin, { updates: [{ id: 'e5', name: 'Everything' }] });

        http.respondToPost(() => ({ status: 200, body: {} }));
        await plugin.syncNow();

        expect(lastPostBody().updates).toEqual([{ id: 'e5', name: 'Everything' }]);
    });

    it('sends the whole entity when an add for the same row is still queued', async () => {
        // The server has never seen this row, so there is nothing for a partial body to patch
        http.respondToPost(() => ({ status: 500 }));
        const plugin = createPlugin();

        await persistPlugin(plugin, { adds: [{ id: 'e6', name: 'Created' }] });
        await persistPlugin(plugin, {
            updatesWithDelta: [{ entity: { id: 'e6', name: 'Edited' }, delta: { name: 'Edited' } }],
        });

        http.respondToPost(() => ({ status: 200, body: {} }));
        await plugin.syncNow();

        const body = lastPostBody();
        expect(body.updates).toEqual([]);
        expect(body.adds).toEqual([{ id: 'e6', name: 'Edited' }]);
    });

    it('leaves adds and removes as whole entities', async () => {
        const plugin = createPlugin();

        await persistPlugin(plugin, {
            adds: [{ id: 'a1', name: 'Added' }],
            removes: [{ id: 'r1', name: 'Removed' }],
        });

        const body = lastPostBody();
        expect(body.adds).toEqual([{ id: 'a1', name: 'Added' }]);
        expect(body.removes).toEqual([{ id: 'r1', name: 'Removed' }]);
    });
});

describe('pacing: RequestPacer', () => {
    it('collapses identical concurrent calls into one', async () => {
        const pacer = new RequestPacer();
        let calls = 0;
        const work = async () => { calls++; await sleep(20); return calls; };

        const results = await Promise.all([
            pacer.share('same', work),
            pacer.share('same', work),
            pacer.share('same', work),
        ]);

        expect(calls).toBe(1);
        // Every caller gets the one answer
        expect(results).toEqual([1, 1, 1]);
    });

    it('starts a fresh call once the shared one has settled', async () => {
        const pacer = new RequestPacer();
        let calls = 0;
        const work = async () => { calls++; return calls; };

        expect(await pacer.share('k', work)).toBe(1);
        expect(await pacer.share('k', work)).toBe(2);
    });

    it('never overlaps calls for one key', async () => {
        const pacer = new RequestPacer();
        let active = 0;
        let peak = 0;

        await Promise.all(Array.from({ length: 6 }, () => pacer.serialize('k', async () => {
            active++;
            peak = Math.max(peak, active);
            await sleep(5);
            active--;
        })));

        expect(peak).toBe(1);
    });

    it('keeps different keys independent', async () => {
        const pacer = new RequestPacer(50);
        const started = Date.now();

        await Promise.all(['a', 'b', 'c'].map((key) => pacer.serialize(key, async () => sleep(5))));

        // A per-key floor must not serialize unrelated collections behind each other
        expect(Date.now() - started).toBeLessThan(50);
    });

    it('spaces successive calls for one key', async () => {
        const pacer = new RequestPacer(60);
        const startedAt: number[] = [];

        await Promise.all(Array.from({ length: 3 }, () => pacer.serialize('k', async () => {
            startedAt.push(Date.now());
        })));

        expect(startedAt).toHaveLength(3);
        expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(50);
        expect(startedAt[2] - startedAt[1]).toBeGreaterThanOrEqual(50);
    });

    it('counts a call waiting at the gate as pending', async () => {
        const pacer = new RequestPacer(80);
        await pacer.serialize('k', async (): Promise<void> => undefined);

        // This one is accepted but held back, so no socket is open — and yet work is outstanding.
        // Anything that waits for idleness by counting open requests would miss it.
        const held = pacer.serialize('k', async (): Promise<void> => undefined);
        expect(pacer.pendingCount()).toBe(1);

        await held;
        expect(pacer.pendingCount()).toBe(0);
    });
});

describe('pacing: reads', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    function createPlugin(options?: SwrOptions) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            autoSync: false,
            ...options,
        });
        created.push(plugin);
        return plugin;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
    });

    it('a cold cache read by several callers at once costs one GET', async () => {
        // The bug this fixes: revalidate deduplicated by cache key but the cache-MISS path did
        // not, so first paint with five components on one query opened five connections.
        http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice' }], delayMs: 30 }));
        const plugin = createPlugin();

        const rows = await Promise.all([
            queryPlugin(plugin),
            queryPlugin(plugin),
            queryPlugin(plugin),
            queryPlugin(plugin),
            queryPlugin(plugin),
        ]);

        expect(http.gets).toHaveLength(1);
        // ...and every caller still gets the data
        for (const result of rows) {
            expect(result).toEqual([expect.objectContaining({ id: 'a' })]);
        }
    });

    it('concurrent stale reads share one revalidate', async () => {
        http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice' }] }));
        const plugin = createPlugin({ maxAgeMs: 0 });
        await queryPlugin(plugin);
        const getsAfterSeed = http.gets.length;

        http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice v2' }], delayMs: 30 }));
        await Promise.all([queryPlugin(plugin), queryPlugin(plugin), queryPlugin(plugin)]);
        await waitFor(async () => {
            const stored = await queryPlugin(swrStore) as Array<{ name: string }>;
            return stored[0]?.name === 'Alice v2';
        }, 'the revalidate to land');

        expect(http.gets.length - getsAfterSeed).toBe(1);
    });
});

describe('pacing: writes', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    function createPlugin(options?: SwrOptions) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            autoSync: false,
            bulkPersistRetryMaxAttempts: 1,
            writeBatchDelayMs: 0,
            ...options,
        });
        created.push(plugin);
        return plugin;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        http.respondToPost(() => ({ status: 200, body: {}, delayMs: 20 }));
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
    });

    it('never opens two POSTs for one collection at once', async () => {
        // Each response takes 25ms, so overlapping requests would start less than 25ms apart.
        // Comparing entry times beats a counter the mock cannot decrement honestly.
        const enteredAt: number[] = [];
        http.respondToPost(() => {
            enteredAt.push(Date.now());
            return { status: 200, body: {}, delayMs: 25 };
        });

        const plugin = createPlugin({ minRequestIntervalMs: 0, writeBatchDelayMs: 0 });
        await Promise.all([
            persistPlugin(plugin, { adds: [{ id: 'p-1', name: 'One' }] }),
            persistPlugin(plugin, { adds: [{ id: 'p-2', name: 'Two' }] }),
            persistPlugin(plugin, { adds: [{ id: 'p-3', name: 'Three' }] }),
        ]);
        await waitFor(() => enteredAt.length === 3, 'all three POSTs to be issued');

        for (let i = 1; i < enteredAt.length; i++) {
            expect(enteredAt[i] - enteredAt[i - 1]).toBeGreaterThanOrEqual(20);
        }
    });

    it('postOnPersist: false sends nothing on the save itself', async () => {
        const plugin = createPlugin({ postOnPersist: false, autoSync: false });

        await persistPlugin(plugin, { adds: [{ id: 'q-1', name: 'Queued' }] });

        // The write is durable and acknowledged, it just has not been delivered yet
        expect(http.posts).toHaveLength(0);
        expect(await plugin.pendingCount()).toBe(1);
        expect(await queryPlugin(swrStore)).toHaveLength(1);

        await plugin.syncNow();
        expect(http.posts).toHaveLength(1);
        expect(await plugin.pendingCount()).toBe(0);
    });

    it('batches ten ordinary saves to one endpoint into one request', async () => {
        const plugin = createPlugin({ writeBatchDelayMs: 25 });

        for (let i = 0; i < 10; i++) {
            await persistPlugin(plugin, { adds: [{ id: `default-burst-${i}`, name: `Item ${i}` }] }, testSchema, 0);
        }

        await waitFor(async () => (await plugin.pendingCount()) === 0, 'the batched POST to settle');

        expect(http.posts).toHaveLength(1);
        expect((http.posts[0].body as { adds: unknown[] }).adds).toHaveLength(10);
    });

    it('postOnPersist: false turns a burst of saves into a single request', async () => {
        // The point of the option: ten rapid saves are ten POSTs by default
        const plugin = createPlugin({ postOnPersist: false, autoSync: { delayMs: 20, minIntervalMs: 50 } });

        for (let i = 0; i < 10; i++) {
            await persistPlugin(plugin, { adds: [{ id: `burst-${i}`, name: `Item ${i}` }] }, testSchema, 0);
        }

        await waitFor(async () => (await plugin.pendingCount()) === 0, 'the paced flush to drain the burst');

        // One request per collection per flush, so ten writes cost a handful of POSTs at most
        expect(http.posts.length).toBeLessThanOrEqual(3);
        const delivered = http.posts.flatMap((p) => (p.body as { adds: unknown[] }).adds);
        expect(delivered).toHaveLength(10);
    });

    it('paces successive saves for one collection when an interval is set', async () => {
        const plugin = createPlugin({ minRequestIntervalMs: 80, writeBatchDelayMs: 0 });
        const started = Date.now();

        await persistPlugin(plugin, { adds: [{ id: 'i-1', name: 'One' }] }, testSchema, 0);
        await persistPlugin(plugin, { adds: [{ id: 'i-2', name: 'Two' }] }, testSchema, 0);
        await waitFor(() => http.posts.length === 2, 'both POSTs to go out');

        expect(Date.now() - started).toBeGreaterThanOrEqual(80);
    });
});

describe('pacing: HttpDbPlugin used on its own', () => {
    let http: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
        http = installFetchMock();
    });

    function createPlugin(options?: Partial<ConstructorParameters<typeof HttpDbPlugin>[0]>) {
        return new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            ...options,
        });
    }

    it('collapses concurrent identical reads into one request', async () => {
        // Pacing lives in the transport, so this holds without a composing plugin above it
        http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'Alice' }], delayMs: 30 }));
        const plugin = createPlugin();

        const results = await Promise.all([
            queryPlugin(plugin),
            queryPlugin(plugin),
            queryPlugin(plugin),
            queryPlugin(plugin),
        ]);

        expect(http.gets).toHaveLength(1);
        for (const rows of results) {
            expect(rows).toEqual([expect.objectContaining({ id: 'a' })]);
        }
    });

    it('gives each caller its own copy of the shared response', async () => {
        // The translator deserializes in place and sorts in place, so handing several callers one
        // parsed body would let them corrupt each other. Each caller parses the shared text.
        http.respondToGet(() => ({
            status: 200,
            body: [{ id: 'b', name: 'Bob' }, { id: 'a', name: 'Alice' }],
            delayMs: 20,
        }));
        const plugin = createPlugin();

        const [first, second] = await Promise.all([queryPlugin(plugin), queryPlugin(plugin)]);

        expect(http.gets).toHaveLength(1);
        expect(first).toHaveLength(2);
        expect(second).toHaveLength(2);
        // Distinct object graphs: mutating one caller's rows must not be visible to the other
        (first[0] as { name: string }).name = 'Mutated';
        expect((second as Array<{ name: string }>).map((r) => r.name)).toEqual(['Bob', 'Alice']);
    });

    it('does not make unrelated collections wait on each other', async () => {
        const otherSchema = s.define('otherThings', {
            id: s.string().key().identity(),
            name: s.string(),
        }).compile();
        http.respondToGet(() => ({ status: 200, body: [] }));
        const plugin = createPlugin({ minRequestIntervalMs: 200 });

        const started = Date.now();
        await Promise.all([queryPlugin(plugin), queryPlugin(plugin, otherSchema)]);

        expect(http.gets).toHaveLength(2);
        expect(Date.now() - started).toBeLessThan(200);
    });

    it('spaces successive writes to one collection', async () => {
        const enteredAt: number[] = [];
        http.respondToPost(() => {
            enteredAt.push(Date.now());
            return { status: 200, body: {} };
        });
        const plugin = createPlugin({ minRequestIntervalMs: 90, writeBatchDelayMs: 0 });
        const url = plugin.collectionUrl('things');

        await Promise.all([
            plugin.postJson(url, '{"adds":[]}', 'things'),
            plugin.postJson(url, '{"adds":[]}', 'things'),
        ]);

        expect(enteredAt).toHaveLength(2);
        expect(enteredAt[1] - enteredAt[0]).toBeGreaterThanOrEqual(80);
    });

    it('minRequestIntervalMs: 0 removes the wait but not the ordering', async () => {
        const enteredAt: number[] = [];
        http.respondToPost(() => {
            enteredAt.push(Date.now());
            return { status: 200, body: {}, delayMs: 15 };
        });
        const plugin = createPlugin({ minRequestIntervalMs: 0, writeBatchDelayMs: 0 });
        const url = plugin.collectionUrl('things');

        await Promise.all([
            plugin.postJson(url, '{"adds":[]}', 'things'),
            plugin.postJson(url, '{"adds":[]}', 'things'),
        ]);

        // Still one at a time — the responses take 15ms and the second starts after the first ends
        expect(enteredAt[1] - enteredAt[0]).toBeGreaterThanOrEqual(10);
    });

    it('reports a non-2xx to every caller sharing the request', async () => {
        http.respondToGet(() => ({ status: 500, delayMs: 20 }));
        const plugin = createPlugin();

        const outcomes = await Promise.allSettled([queryPlugin(plugin), queryPlugin(plugin)]);

        // One request, both callers told the truth about it
        expect(http.gets).toHaveLength(1);
        for (const outcome of outcomes) {
            expect(outcome.status).toBe('rejected');
        }
    });
});

describe('reads: an empty result is not a cold cache', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    function createPlugin(options?: SwrOptions) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            autoSync: false,
            minRequestIntervalMs: 0,
            ...options,
        });
        created.push(plugin);
        return plugin;
    }

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
    });

    it('fetches a collection it has never fetched', async () => {
        http.respondToGet(() => ({ status: 200, body: [] }));
        const plugin = createPlugin({ maxAgeMs: 60_000 });

        await expect(queryPlugin(plugin)).resolves.toEqual([]);

        // Nothing cached yet, so the empty answer has to come from somewhere
        expect(http.gets).toHaveLength(1);
    });

    it('serves a genuinely empty collection from cache while it is fresh', async () => {
        // The bug: "no rows" read as "nothing cached", so every read of an empty view was a
        // request — three reads cost four GETs inside a 60s freshness window.
        http.respondToGet(() => ({ status: 200, body: [] }));
        const plugin = createPlugin({ maxAgeMs: 60_000 });

        await queryPlugin(plugin);
        const afterFirst = http.gets.length;

        await queryPlugin(plugin);
        await queryPlugin(plugin);
        await queryPlugin(plugin);

        expect(http.gets).toHaveLength(afterFirst);
    });

    it('refetches an empty collection once it goes stale', async () => {
        http.respondToGet(() => ({ status: 200, body: [] }));
        const plugin = createPlugin({ maxAgeMs: 0 });

        await queryPlugin(plugin);
        await queryPlugin(plugin);

        // maxAgeMs 0 means always stale, so the empty answer is re-checked every time
        expect(http.gets.length).toBeGreaterThanOrEqual(2);
    });

    it('picks up rows that appear on the server after an empty fetch', async () => {
        // Negative caching must not mean "empty forever"
        http.respondToGet(() => ({ status: 200, body: [] }));
        const plugin = createPlugin({ maxAgeMs: 30 });
        await queryPlugin(plugin);

        http.respondToGet(() => ({ status: 200, body: [{ id: 'new', name: 'Appeared' }] }));
        await sleep(40);

        await waitFor(async () => (await queryPlugin(plugin) as unknown[]).length === 1, 'the new row to arrive');
    });
});
