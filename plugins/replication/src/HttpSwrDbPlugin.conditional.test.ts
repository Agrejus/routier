import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { logger } from '@routier/core/utilities';
import { createQueryEvent, destroyEvent, installFetchMock, persistPlugin, queryPlugin, RecordingMemoryPlugin, sleep, waitFor, type HttpResponseSpec } from './__tests__/httpTestKit';

const itemSchema = s.define('swrConditional', {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

type Options = { conditionalRevalidation?: boolean, maxAgeMs?: number, onRevalidateNotModified?: (context: { collectionName: string, cacheKey: string }) => void };

const rows = [{ id: 'a', name: 'one' }, { id: 'b', name: 'two' }];
const withEtag = (etag: string): HttpResponseSpec => ({ status: 200, body: rows, headers: { ETag: etag } });
const ifNoneMatch = (http: ReturnType<typeof installFetchMock>) => http.gets.map(call => call.headers['If-None-Match'] ?? null);

describe('HttpSwrDbPlugin conditional revalidation', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    const createPlugin = (options: Options = {}) => {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            maxAgeMs: 0,
            ...options,
        });
        created.push(plugin);
        return plugin;
    };

    const read = async (plugin: HttpSwrDbPlugin, expectedGets: number) => {
        await queryPlugin(plugin, itemSchema);
        await waitFor(() => http.gets.length === expectedGets, `${expectedGets} requests`);
        await sleep(20);
    };


    beforeEach(() => {
        http = installFetchMock();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await Promise.all(created.splice(0).map(plugin => new Promise<void>(resolve => plugin.destroy(destroyEvent(), () => resolve()))));
    });

    it('sends back the etag the first fetch returned', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();

        await read(plugin, 1);
        await read(plugin, 2);

        expect(ifNoneMatch(http)).toEqual([null, '"v1"']);
    });

    it('keeps the local rows and reports not modified on a 304', async () => {
        const onRevalidateNotModified = jest.fn();
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin({ onRevalidateNotModified });
        await read(plugin, 1);

        http.respondToGet(() => ({ status: 304 }));
        await read(plugin, 2);

        expect(await queryPlugin(swrStore, itemSchema)).toEqual(rows);
        expect(onRevalidateNotModified).toHaveBeenCalledWith({ collectionName: 'swrConditional', cacheKey: expect.any(String) });
    });

    it('treats a 304 as fresh data', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin({ maxAgeMs: 200 });
        await read(plugin, 1);
        await sleep(220);

        http.respondToGet(() => ({ status: 304 }));
        await read(plugin, 2);
        await queryPlugin(plugin, itemSchema);
        await sleep(20);

        expect(http.gets.length).toBe(2);
    });

    it('remembers the etag across a reload', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        await read(createPlugin(), 1);

        await read(createPlugin(), 2);

        expect(ifNoneMatch(http)).toEqual([null, '"v1"']);
    });

    it('replaces the etag when the server returns a new one', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        http.respondToGet(() => withEtag('"v2"'));
        await read(plugin, 2);
        await read(plugin, 3);

        expect(ifNoneMatch(http)).toEqual([null, '"v1"', '"v2"']);
    });

    it('forgets the etag when the server stops sending one', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        http.respondToGet(() => ({ status: 200, body: rows }));
        await read(plugin, 2);
        await read(plugin, 3);

        expect(ifNoneMatch(http)).toEqual([null, '"v1"', null]);
    });

    it('forgets the etag when the server rejects a local edit', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        http.respondToPost(() => ({ status: 422, body: {} }));
        const plugin = createPlugin({ maxAgeMs: 60_000 });
        await read(plugin, 1);

        await persistPlugin(plugin, { updates: [{ id: 'a', name: 'edited' }] }, itemSchema);
        expect((await plugin.syncNow()).deadLettered).toBe(1);
        await read(plugin, 2);

        expect(ifNoneMatch(http)).toEqual([null, null]);
    });

    it.each([
        ['keeps sending the etag of another collection', 0, [null, '"v1"']],
        ['keeps another collection fresh', 60_000, [null]],
    ])('%s when the server rejects a local edit', async (_, maxAgeMs, expected) => {
        const otherSchema = s.define('swrConditionalUntouched', { id: s.string().key(), name: s.string() }).compile();
        http.respondToGet(() => withEtag('"v1"'));
        http.respondToPost(() => ({ status: 422, body: {} }));
        const plugin = createPlugin({ maxAgeMs });
        await read(plugin, 1);
        await queryPlugin(plugin, otherSchema);
        await waitFor(() => http.gets.length === 2, 'the other collection');
        await sleep(20);

        await persistPlugin(plugin, { updates: [{ id: 'a', name: 'edited' }] }, itemSchema);
        expect((await plugin.syncNow()).deadLettered).toBe(1);
        await queryPlugin(plugin, otherSchema);
        await sleep(50);

        expect(http.gets.filter(call => call.url.endsWith('swrConditionalUntouched')).map(call => call.headers['If-None-Match'] ?? null)).toEqual(expected);
    });

    it('forgets the etags of every collection whose edits the server rejects', async () => {
        const otherSchema = s.define('swrConditionalRejected', { id: s.string().key(), name: s.string() }).compile();
        http.respondToGet(() => withEtag('"v1"'));
        http.respondToPost(() => ({ status: 422, body: {} }));
        const plugin = createPlugin({ maxAgeMs: 60_000 });
        await read(plugin, 1);
        await queryPlugin(plugin, otherSchema);
        await waitFor(() => http.gets.length === 2, 'the other collection');
        await sleep(20);

        await persistPlugin(plugin, { updates: [{ id: 'a', name: 'edited' }] }, itemSchema);
        await persistPlugin(plugin, { updates: [{ id: 'a', name: 'edited' }] }, otherSchema);
        expect((await plugin.syncNow()).deadLettered).toBe(2);
        await read(plugin, 3);
        await queryPlugin(plugin, otherSchema);
        await waitFor(() => http.gets.length === 4, 'both refetches');

        expect(ifNoneMatch(http)).toEqual([null, null, null, null]);
    });

    it('handles a rejected edit queued before a reload', async () => {
        http.respondToPost(() => ({ status: 422, body: {} }));
        await persistPlugin(createPlugin(), { updates: [{ id: 'a', name: 'edited' }] }, itemSchema);

        expect((await createPlugin().syncNow()).deadLettered).toBe(1);
    });

    it('handles a rejected local edit when conditional revalidation is off', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        http.respondToPost(() => ({ status: 422, body: {} }));
        const plugin = createPlugin({ conditionalRevalidation: false, maxAgeMs: 60_000 });
        await read(plugin, 1);

        await persistPlugin(plugin, { updates: [{ id: 'a', name: 'edited' }] }, itemSchema);
        expect((await plugin.syncNow()).deadLettered).toBe(1);
        await read(plugin, 2);

        expect(ifNoneMatch(http)).toEqual([null, null]);
    });

    it('logs nothing when conditional revalidation is off', async () => {
        const warn = jest.spyOn(logger, 'warn');
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin({ conditionalRevalidation: false });

        await read(plugin, 1);
        await read(plugin, 2);

        expect(warn).not.toHaveBeenCalled();
    });

    it('never sends an etag when conditional revalidation is off', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin({ conditionalRevalidation: false });

        await read(plugin, 1);
        await read(plugin, 2);

        expect(ifNoneMatch(http)).toEqual([null, null]);
    });

    it('does not send the etag when rows went missing from the local store', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        await persistPlugin(swrStore, { removes: [rows[1]] }, itemSchema);

        await read(plugin, 2);

        expect(ifNoneMatch(http)).toEqual([null, null]);
    });
});

class FailingStore extends RecordingMemoryPlugin {
    failItemWrites = false;
    failRevalidateReads = false;

    override bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        if (this.failItemWrites && event.operation.get(itemSchema.id)?.hasItems === true) {
            done(PluginEventResult.error(event.id, new Error('write failed')));
            return;
        }

        super.bulkPersist(event, done);
    }

    override query<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        if (this.failRevalidateReads && event.reason === 'revalidate') {
            done(PluginEventResult.error(event.id, new Error('read failed')));
            return;
        }

        super.query(event, done);
    }
}

describe('HttpSwrDbPlugin conditional revalidation failures', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: FailingStore;
    const created: HttpSwrDbPlugin[] = [];

    const createPlugin = (options: { onRevalidateError?: (error: Error, context: { collectionName: string, cacheKey?: string }) => void } = {}) => {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: new MemoryPlugin(`queue-${uuid(8)}`),
            maxAgeMs: 0,
            queryRetryMaxAttempts: 1,
            ...options,
        });
        created.push(plugin);
        return plugin;
    };

    const read = async (plugin: HttpSwrDbPlugin, expectedGets: number) => {
        await queryPlugin(plugin, itemSchema);
        await waitFor(() => http.gets.length === expectedGets, `${expectedGets} requests`);
        await sleep(20);
    };

    const itemWrites = () => swrStore.writes.filter(event => event.operation.get(itemSchema.id)?.hasItems === true);

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new FailingStore(`swr-${uuid(8)}`);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await Promise.all(created.splice(0).map(plugin => new Promise<void>(resolve => plugin.destroy(destroyEvent(), () => resolve()))));
    });

    it('reports a failed revalidation', async () => {
        const onRevalidateError = jest.fn();
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin({ onRevalidateError });
        await read(plugin, 1);

        http.respondToGet(() => ({ status: 500 }));
        await read(plugin, 2);

        expect(onRevalidateError).toHaveBeenCalledWith(expect.any(Error), { collectionName: 'swrConditional', cacheKey: expect.any(String) });
    });

    it('handles a failed revalidation without an error hook', async () => {
        const warn = jest.spyOn(logger, 'warn');
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        http.respondToGet(() => ({ status: 500 }));
        await read(plugin, 2);

        expect(warn).not.toHaveBeenCalledWith('[HttpSwrDbPlugin] revalidate failed', expect.anything());
    });

    it('keeps the stored etag when the local rows cannot be counted after a fetch', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        swrStore.failRevalidateReads = true;
        http.respondToGet(() => withEtag('"v2"'));
        await read(plugin, 2);
        swrStore.failRevalidateReads = false;
        await read(plugin, 3);

        expect(ifNoneMatch(http)).toEqual([null, null, '"v1"']);
    });

    it('handles a 304 without a not-modified hook', async () => {
        const warn = jest.spyOn(logger, 'warn');
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        http.respondToGet(() => ({ status: 304 }));
        await read(plugin, 2);

        expect(warn).not.toHaveBeenCalledWith('[HttpSwrDbPlugin] revalidate failed', expect.anything());
    });

    it('writes nothing when the server returns the same rows', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);
        const writesAfterFirstFetch = itemWrites().length;

        await read(plugin, 2);

        expect(itemWrites().length).toBe(writesAfterFirstFetch);
    });

    it('keeps the old etag when the new rows could not be stored', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        swrStore.failItemWrites = true;
        http.respondToGet(() => ({ status: 200, body: [...rows, { id: 'c', name: 'three' }], headers: { ETag: '"v2"' } }));
        await read(plugin, 2);
        swrStore.failItemWrites = false;
        await read(plugin, 3);

        expect(ifNoneMatch(http)).toEqual([null, '"v1"', '"v1"']);
    });

    it('sends no etag when the local rows cannot be counted', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);

        swrStore.failRevalidateReads = true;
        await read(plugin, 2);

        expect(ifNoneMatch(http)).toEqual([null, null]);
    });

    it('revalidates two queries separately', async () => {
        const otherSchema = s.define('swrConditionalOther', { id: s.string().key(), name: s.string() }).compile();
        swrStore.seed(itemSchema, rows);
        swrStore.seed(otherSchema, rows);
        http.respondToGet(() => ({ status: 200, body: rows, delayMs: 20 }));
        const plugin = createPlugin();

        await Promise.all([queryPlugin(plugin, itemSchema), queryPlugin(plugin, otherSchema)]);
        await waitFor(() => http.gets.length === 2, 'both revalidations');

        expect(http.gets.map(call => call.url).sort()).toEqual(['https://api.test/swrConditional', 'https://api.test/swrConditionalOther']);
    });

    it('logs a cold fetch that failed', async () => {
        const warn = jest.spyOn(logger, 'warn');
        http.respondToGet(() => ({ status: 500 }));

        await queryPlugin(createPlugin(), itemSchema);

        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] query remote failed, falling back to SWR store', { collectionName: 'swrConditional' });
    });

    it('keeps the background request out of the caller query log', async () => {
        http.respondToGet(() => withEtag('"v1"'));
        const plugin = createPlugin();
        await read(plugin, 1);
        const event = { ...createQueryEvent(itemSchema), explain: true };

        await new Promise(resolve => plugin.query(event, resolve));
        await waitFor(() => http.gets.length === 2, 'the revalidation request');
        await sleep(20);

        expect(event.executedQueries.filter(query => query.text.startsWith('GET '))).toEqual([]);
    });
});
