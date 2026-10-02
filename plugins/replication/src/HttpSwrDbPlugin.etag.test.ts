import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { etags, s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { destroyEvent, installFetchMock, persistPlugin, queryPlugin, RecordingMemoryPlugin, sleep, waitFor } from './__tests__/httpTestKit';

const versionedSchema = s.define('swrVersioned', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric).optional(),
}).compile();

type VersionedRow = { id: string, name: string, version?: number };


describe('HttpSwrDbPlugin etags', () => {
    let http: ReturnType<typeof installFetchMock>;
    let swrStore: RecordingMemoryPlugin;
    let queueStore: MemoryPlugin;
    const created: HttpSwrDbPlugin[] = [];

    const createPlugin = () => {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            autoSync: false,
            getUrl: (collection) => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            maxAgeMs: 0,
            bulkPersistRetryBaseDelayMs: 60_000,
            bulkPersistRetryMaxAttempts: 1,
            translatePersistResponse: (_schema, body) => (body as { saved?: unknown[] }).saved ?? null,
        });
        created.push(plugin);
        return plugin;
    };

    const stored = async (): Promise<VersionedRow[]> => await queryPlugin(swrStore, versionedSchema) as VersionedRow[];

    const revalidateWith = async (rows: VersionedRow[]) => {
        http.respondToGet(() => ({ status: 200, body: rows }));
        const plugin = createPlugin();
        await queryPlugin(plugin, versionedSchema);
        await waitFor(() => http.gets.length === 1, 'the revalidation request');
        await sleep(30);
    };

    beforeEach(() => {
        http = installFetchMock();
        swrStore = new RecordingMemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        await Promise.all(created.splice(0).map(plugin => new Promise<void>(resolve => plugin.destroy(destroyEvent(), () => resolve()))));
    });

    it('replaces the local row with a newer server row and keeps the server etag', async () => {
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'local', version: 5 }]);

        await revalidateWith([{ id: 'a', name: 'server', version: 9 }]);

        expect(await stored()).toEqual([{ id: 'a', name: 'server', version: 9 }]);
    });

    it('skips a server row with the same etag even when its fields differ', async () => {
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'local', version: 5 }]);

        await revalidateWith([{ id: 'a', name: 'server', version: 5 }]);

        expect(await stored()).toEqual([{ id: 'a', name: 'local', version: 5 }]);
    });

    it('keeps the local row when the server row is older', async () => {
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'local', version: 5 }]);

        await revalidateWith([{ id: 'a', name: 'stale', version: 3 }]);

        expect(await stored()).toEqual([{ id: 'a', name: 'local', version: 5 }]);
    });

    it.each([
        ['the local row', { id: 'a', name: 'local' }, { id: 'a', name: 'server', version: 9 }],
        ['the server row', { id: 'a', name: 'local', version: 5 }, { id: 'a', name: 'server' }],
    ])('compares fields when %s has no etag', async (_, local, server) => {
        swrStore.seed(versionedSchema, [local]);

        await revalidateWith([server]);

        expect(await stored()).toEqual([server]);
    });

    it('adds a row the local store does not have without also updating it', async () => {
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'local', version: 5 }]);

        await revalidateWith([{ id: 'a', name: 'local', version: 5 }, { id: 'b', name: 'new', version: 1 }]);

        const changes = swrStore.writes.map(event => event.operation.get(versionedSchema.id));
        expect(changes.map(change => [change?.adds.length, change?.updates.length])).toEqual([[1, 0]]);
    });

    it('tells the local store to keep etags on every write', async () => {
        http.respondToPost(() => ({ status: 200, body: { saved: [{ id: 'b', name: 'saved', version: 2 }] } }));
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'local', version: 5 }]);

        await revalidateWith([{ id: 'a', name: 'server', version: 9 }]);
        await persistPlugin(createPlugin(), { adds: [{ id: 'b', name: 'saved' }] }, versionedSchema);
        await waitFor(() => swrStore.writes.length === 3, 'the revalidation, optimistic and echo writes');

        expect(swrStore.writes.map(event => [event.reason, event.etags])).toEqual([
            ['revalidate', 'keep'],
            ['optimistic', 'keep'],
            ['persist-echo', 'keep'],
        ]);
    });

    it('lets the server copy replace a local edit the server rejected, even with the same etag', async () => {
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'server', version: 5 }]);
        http.respondToPost(() => ({ status: 422, body: {} }));
        const writer = createPlugin();
        await persistPlugin(writer, { updates: [{ id: 'a', name: 'edited', version: 5 }] }, versionedSchema);
        const outcome = await writer.syncNow();
        expect(outcome.deadLettered).toBe(1);

        await revalidateWith([{ id: 'a', name: 'server', version: 5 }]);

        expect(await stored()).toEqual([{ id: 'a', name: 'server', version: 5 }]);
    });

    it('stores the server etag on a first fetch', async () => {
        http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'server', version: 9 }] }));

        await queryPlugin(createPlugin(), versionedSchema);

        expect(await stored()).toEqual([{ id: 'a', name: 'server', version: 9 }]);
    });

    it('leaves the etag alone on a local update that has not reached the server', async () => {
        swrStore.seed(versionedSchema, [{ id: 'a', name: 'local', version: 5 }]);

        await persistPlugin(createPlugin(), { updates: [{ id: 'a', name: 'edited', version: 5 }] }, versionedSchema);

        expect(await stored()).toEqual([{ id: 'a', name: 'edited', version: 5 }]);
    });

    it('stores the etag the server echoes after a save', async () => {
        http.respondToPost(() => ({ status: 200, body: { saved: [{ id: 'a', name: 'saved', version: 9 }] } }));

        await persistPlugin(createPlugin(), { adds: [{ id: 'a', name: 'saved' }] }, versionedSchema);

        await waitFor(async () => (await stored())[0]?.version === 9, 'the echoed etag');
        expect(await stored()).toEqual([{ id: 'a', name: 'saved', version: 9 }]);
    });
});
