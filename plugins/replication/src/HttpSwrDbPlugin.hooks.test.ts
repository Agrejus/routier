import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BulkPersistResult, SchemaPersistChanges } from '@routier/core/collections';
import { DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventResult } from '@routier/core/results';
import { CompiledSchema, s } from '@routier/core/schema';
import { logger, UnknownRecord, uuid } from '@routier/core/utilities';
import { HttpSwrDbPlugin, type HttpSwrDbPluginOptions } from './HttpSwrDbPlugin';
import type { SwrRequestError, SyncEvent } from './syncHooks';
import type { QueuedChange } from './UnsyncedQueue';
import {
    createPersistEvent,
    destroyEvent,
    installFetchMock,
    persistPlugin,
    queryPlugin,
    RecordingMemoryPlugin,
    sleep,
    testSchema,
    waitFor,
    type PersistChangeSet,
} from './__tests__/httpTestKit';

const otherSchema = s.define('swrHooksOther', { id: s.string().key(), name: s.string() }).compile();

class FailingStore extends RecordingMemoryPlugin {
    failWrites = false;

    override bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        if (this.failWrites) {
            done(PluginEventResult.error(event.id, new Error('store is full')));
            return;
        }

        super.bulkPersist(event, done);
    }
}

class ShapedSwrPlugin extends HttpSwrDbPlugin {
    protected override formatRequestBody(changes: SchemaPersistChanges<Record<string, unknown>>, _schema: CompiledSchema<UnknownRecord>, queued: QueuedChange[] = []) {
        return JSON.stringify({
            shaped: true,
            adds: changes.adds,
            updates: changes.updates.map(update => [update.changeType, update.delta]),
            removes: changes.removes,
            opIds: queued.map(change => typeof change.opId),
        });
    }
}

type Options = Partial<HttpSwrDbPluginOptions>;

describe('HttpSwrDbPlugin hooks', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: FailingStore;
    let queueStore: FailingStore;
    let events: SyncEvent[];
    const created: HttpSwrDbPlugin[] = [];

    const optionsWith = (options: Options): HttpSwrDbPluginOptions => ({
        getUrl: (collection) => `https://api.test/${collection}`,
        unsyncedQueueStore: queueStore,
        maxAgeMs: 0,
        onEvent: (event) => events.push(event),
        ...options,
    });

    const create = (options: Options = {}) => {
        const plugin = new HttpSwrDbPlugin(swrStore, optionsWith(options));
        created.push(plugin);
        return plugin;
    };

    const createShaped = (options: Options = {}) => {
        const plugin = new ShapedSwrPlugin(swrStore, optionsWith(options));
        created.push(plugin);
        return plugin;
    };

    const save = (plugin: HttpSwrDbPlugin, changes: PersistChangeSet, schema: unknown = testSchema) =>
        new Promise<void>((resolve) => plugin.bulkPersist(createPersistEvent(changes, schema), () => resolve()));

    const rejectWrites = (error: SwrRequestError) => (error.operation === 'write' ? error.reject() : error.done());

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new FailingStore(`swr-${uuid(8)}`);
        queueStore = new FailingStore(`queue-${uuid(8)}`);
        events = [];
    });

    afterEach(async () => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        await Promise.all(created.splice(0).map(plugin => new Promise<void>(resolve => plugin.destroy(destroyEvent(), () => resolve()))));
    });

    describe('a first read', () => {
        it('reports a successful fetch once', async () => {
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'A' }] }));

            await queryPlugin(create());

            expect(events).toEqual([{ type: 'read', ok: true, collectionName: 'swrHardening', status: 200 }]);
        });

        it('fails on a 304 it did not ask for', async () => {
            http.respondToGet(() => ({ status: 304 }));

            await expect(queryPlugin(create())).rejects.toThrow('HTTP 304: Not Modified');
            expect(events).toEqual([{ type: 'read', ok: false, collectionName: 'swrHardening', status: 304, error: expect.any(Error) }]);
        });

        it('fails when the fetched rows cannot be stored', async () => {
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'A' }] }));
            swrStore.failWrites = true;

            await expect(queryPlugin(create())).rejects.toThrow('store is full');
            expect(events).toEqual([{ type: 'read', ok: false, collectionName: 'swrHardening', status: null, error: expect.any(Error) }]);
        });

        it('fails when the request cannot even be built', async () => {
            const plugin = create({ getUrl: () => { throw new Error('no url'); } });

            await expect(queryPlugin(plugin)).rejects.toThrow('no url');
        });

        it('answers from the store when onError uses the cache', async () => {
            http.respondToGet(() => ({ status: 503 }));

            expect(await queryPlugin(create({ onError: (error) => (error.operation === 'read' ? error.useCached() : error.defer()) }))).toEqual([]);
        });

        it('describes the failed GET to onError', async () => {
            const seen: SwrRequestError[] = [];
            http.respondToGet(() => ({ status: 503 }));

            await queryPlugin(create({ onError: (error) => { seen.push(error); return error.operation === 'read' ? error.useCached() : error.defer(); } }));

            expect(seen.map(error => [error.method, error.url, error.operation])).toEqual([['GET', 'https://api.test/swrHardening', 'read']]);
        });

        it('does not ask onError about a response it cannot read', async () => {
            const onError = jest.fn();
            http.respondToGet(() => ({ status: 200, text: 'not json' }));

            await expect(queryPlugin(create({ onError }))).rejects.toThrow();
            expect(onError).not.toHaveBeenCalled();
        });
    });

    describe('a revalidation', () => {
        it('reports a successful refresh', async () => {
            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'A' }] }));
            const plugin = create({ conditionalRevalidation: false });
            await queryPlugin(plugin);

            http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'B' }] }));
            await queryPlugin(plugin);
            await waitFor(() => events.length === 2, 'the refresh');

            expect(events).toEqual([
                { type: 'read', ok: true, collectionName: 'swrHardening', status: 200 },
                { type: 'read', ok: true, collectionName: 'swrHardening', status: 200 },
            ]);
        });
    });

    describe('a sync', () => {
        it('reports a sync that only rejected changes', async () => {
            http.respondToPost(() => ({ status: 422 }));
            const plugin = create({ postOnPersist: false, onError: rejectWrites });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            await plugin.syncNow();

            expect(events.filter(event => event.type === 'synced')).toEqual([{ type: 'synced', sent: 0, failed: 0, rejected: 1 }]);
        });

        it('shapes every request with formatRequestBody', async () => {
            const plugin = createShaped({ postOnPersist: false });
            await new Promise<void>((resolve) => plugin.bulkPersist(createPersistEvent({ updatesWithDelta: [{ entity: { id: 'a', name: 'edited' }, delta: { name: 'edited' } }] }), () => resolve()));

            await plugin.syncNow();

            expect(http.posts.map(post => post.body)).toEqual([{
                shaped: true,
                adds: [],
                updates: [['markedDirty', { id: 'a', name: 'edited' }]],
                removes: [],
                opIds: ['string'],
            }]);
        });

        it('sends the default body for a collection it has not seen since a reload', async () => {
            await save(create({ postOnPersist: false }), { adds: [{ id: 'a', name: 'A' }] });

            await createShaped({ postOnPersist: false }).syncNow();

            expect(http.posts.map(post => post.body)).toEqual([{
                adds: [{ id: 'a', name: 'A' }],
                updates: [],
                removes: [],
                meta: { opIds: { adds: [expect.any(String)], updates: [], removes: [] } },
            }]);
        });
    });

    describe('a save', () => {
        it('sends the queue after the default batching window', async () => {
            jest.useFakeTimers();
            const plugin = create();
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });
            const seen: number[] = [];

            await jest.advanceTimersByTimeAsync(40);
            seen.push(http.posts.length);
            await jest.advanceTimersByTimeAsync(60);
            seen.push(http.posts.length);

            expect(seen).toEqual([0, 1]);
        });

        it('logs a send after a save that failed outright', async () => {
            const warn = jest.spyOn(logger, 'warn');
            const plugin = create();

            await persistPlugin(plugin, { adds: [{ id: 'a', name: 'A' }] }, testSchema, 0);
            queueStore.failWrites = true;
            await waitFor(() => warn.mock.calls.some(([message]) => message === '[HttpSwrDbPlugin] could not send the saved changes; they stay queued'), 'the warning');

            expect(warn.mock.calls.find(([message]) => message === '[HttpSwrDbPlugin] could not send the saved changes; they stay queued')?.[1]).toEqual({ error: expect.any(Error) });
        });
    });

    describe('background sync', () => {
        const globals = globalThis as unknown as {
            addEventListener?: EventTarget['addEventListener'];
            removeEventListener?: EventTarget['removeEventListener'];
            dispatchEvent?: EventTarget['dispatchEvent'];
        };
        let saved: Pick<typeof globals, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

        beforeEach(() => {
            saved = { addEventListener: globals.addEventListener, removeEventListener: globals.removeEventListener, dispatchEvent: globals.dispatchEvent };
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

        const postsTo = (collection: string) => http.posts.filter(post => post.url.endsWith(`/${collection}`)).length;

        const flushesAt = async (times: number[], count: () => number) => {
            const seen: number[] = [];
            let elapsed = 0;

            for (const time of times) {
                await jest.advanceTimersByTimeAsync(time - elapsed);
                elapsed = time;
                seen.push(count());
            }

            return seen;
        };

        it('is off unless asked for', async () => {
            jest.useFakeTimers();
            http.respondToPost(() => ({ status: 503 }));
            const plugin = create({ postOnPersist: false });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            await jest.advanceTimersByTimeAsync(120_000);

            expect(http.posts).toHaveLength(0);
        });

        it('backs off from one second to a one-minute ceiling by default', async () => {
            jest.useFakeTimers();
            http.respondToPost(() => ({ status: 503 }));
            const plugin = create({ postOnPersist: false, autoSync: true });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            const seen = await flushesAt([999, 1_300, 2_999, 3_300, 6_999, 7_300, 62_999, 63_300, 122_999, 123_300], () => http.posts.length);

            expect(seen).toEqual([0, 1, 1, 2, 2, 3, 5, 6, 6, 7]);
        });

        it('backs off between syncs that found nothing to send', async () => {
            jest.useFakeTimers();
            const reads = jest.spyOn(queueStore, 'query');
            create({ postOnPersist: false, autoSync: { delayMs: 1_000 } });

            const seen = await flushesAt([999, 1_050, 2_999, 3_050], () => reads.mock.calls.length);

            expect(seen.map(count => count - seen[0]!)).toEqual([0, 1, 1, 2]);
        });

        it('starts over at the first delay after a sync that delivered everything', async () => {
            jest.useFakeTimers();
            let fail = true;
            http.respondToPost(() => (fail ? { status: 503 } : { status: 200, body: {} }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 1_000 } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            await jest.advanceTimersByTimeAsync(1_050);
            fail = false;
            await jest.advanceTimersByTimeAsync(2_100);
            await save(plugin, { adds: [{ id: 'b', name: 'B' }] });
            const seen = await flushesAt([900, 1_300], () => http.posts.length);

            expect(seen).toEqual([2, 3]);
        });

        it('keeps backing off after a sync that delivered only some changes', async () => {
            jest.useFakeTimers();
            http.respondToPost((call) => (call.url.endsWith('/swrHooksOther') ? { status: 503 } : { status: 200, body: {} }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 1_000 } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });
            await save(plugin, { adds: [{ id: 'b', name: 'B' }] }, otherSchema);

            const seen = await flushesAt([1_300, 2_999, 3_400], () => postsTo('swrHooksOther'));

            expect(seen).toEqual([1, 1, 2]);
        });

        it('takes delay overrides', async () => {
            jest.useFakeTimers();
            http.respondToPost(() => ({ status: 503 }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 1_000, maxDelayMs: 1_500, minIntervalMs: 10 } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            const seen = await flushesAt([999, 1_300, 2_499, 2_800, 3_999, 4_300], () => http.posts.length);

            expect(seen).toEqual([0, 1, 1, 2, 2, 3]);
        });

        it('spaces syncs by a quarter second by default', async () => {
            jest.useFakeTimers();
            http.respondToPost(() => ({ status: 503 }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 100, maxDelayMs: 100 } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            const seen = await flushesAt([150, 300, 450], () => http.posts.length);

            expect(seen).toEqual([1, 1, 2]);
        });

        it('takes a minimum interval override', async () => {
            jest.useFakeTimers();
            http.respondToPost(() => ({ status: 503 }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 100, maxDelayMs: 100, minIntervalMs: 500 } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            const seen = await flushesAt([150, 550, 700], () => http.posts.length);

            expect(seen).toEqual([1, 1, 2]);
        });

        it('syncs when the browser comes back online by default', async () => {
            http.respondToPost(() => ({ status: 200, body: {} }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 60_000 } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            globals.dispatchEvent?.(new Event('online'));

            await waitFor(() => http.posts.length === 1, 'the online sync');
        });

        it('does not sync on online when told not to', async () => {
            http.respondToPost(() => ({ status: 200, body: {} }));
            const plugin = create({ postOnPersist: false, autoSync: { delayMs: 60_000, syncWhenOnline: false } });
            await save(plugin, { adds: [{ id: 'a', name: 'A' }] });

            globals.dispatchEvent?.(new Event('online'));
            await sleep(50);

            expect(http.posts).toHaveLength(0);
        });
    });
});
