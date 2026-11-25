import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { etags, s } from '@routier/core/schema';
import { byCollection, clientWins, fieldMerge, serverWins, type ConflictResolver } from '@routier/core/plugins';
import { uuid } from '@routier/core/utilities';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import type { HttpSwrDbPluginOptions } from './HttpSwrDbPlugin';
import type { SyncEvent } from './syncHooks';
import { installFetchMock, readQueueRows, waitFor } from './__tests__/httpTestKit';

const todoSchema = s.define('conflictTodos', {
    id: s.string().key(),
    title: s.string(),
    done: s.boolean(),
    version: s.number().etag(etags.numeric).optional(),
}).compile();

type Todo = { id: string; title: string; done: boolean; version?: number };

class Store extends DataStore {
    todos = this.collection(todoSchema).proxy().create();
}

const SERVER: Todo = { id: 't1', title: 'Write', done: false, version: 1 };

describe('HttpSwrDbPlugin conflict resolution', () => {
    let http: ReturnType<typeof installFetchMock>;
    let events: SyncEvent[];
    let queueStore: MemoryPlugin;
    const stores: Store[] = [];

    beforeEach(() => {
        http = installFetchMock();
        events = [];
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        http.respondToGet(() => ({ status: 200, body: [SERVER] }));
    });

    afterEach(() => {
        jest.restoreAllMocks();

        for (const store of stores.splice(0)) {
            store[Symbol.dispose]();
        }
    });

    const open = (options: Partial<HttpSwrDbPluginOptions> = {}) => {
        const plugin = new HttpSwrDbPlugin(new MemoryPlugin(`swr-${uuid(8)}`), {
            getUrl: collection => `https://api.test/${collection}`,
            unsyncedQueueStore: queueStore,
            autoSync: false,
            postOnPersist: false,
            onEvent: event => events.push(event),
            ...options,
        });

        const store = new Store(plugin);

        stores.push(store);

        return { plugin, store };
    };

    /** Loads the server row, edits it locally, and saves, so one update is queued. */
    const editTitle = async (options: Partial<HttpSwrDbPluginOptions>, title = 'Mine') => {
        const opened = open(options);
        const todo = await opened.store.todos.firstAsync(x => x.id === 't1');

        todo.title = title;
        await opened.store.saveChangesAsync();

        return opened;
    };

    const conflictOnce = (body: object | null) => {
        let refused = false;

        http.respondToPost(() => {
            if (refused) {
                return { status: 200, body: {} };
            }

            refused = true;
            return { status: 409, body: body ?? {} };
        });
    };

    const localRow = async (store: Store) => store.todos.firstOrUndefinedAsync(x => x.id === 't1');

    it('merges a field only the client changed with the server row from the 409 body, and sends it over the server version', async () => {
        conflictOnce({ ...SERVER, done: true, version: 2 });
        const { plugin, store } = await editTitle({ resolveConflict: fieldMerge() });

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ sent: 0, failed: 0, rejected: 0, resolved: 1 });
        expect(events).toContainEqual({ type: 'conflict-resolved', collectionName: 'conflictTodos', outcome: 'merged' });
        expect(await localRow(store)).toEqual({ id: 't1', title: 'Mine', done: true, version: 2 });

        await plugin.syncNow();

        expect(http.posts.at(-1)?.body).toEqual(expect.objectContaining({ updates: [{ id: 't1', title: 'Mine', version: 2 }] }));
        expect(await readQueueRows(queueStore)).toEqual([]);
    });

    it('sends the merged row without waiting for syncNow when saves post immediately', async () => {
        conflictOnce({ ...SERVER, done: true, version: 2 });
        await editTitle({ resolveConflict: fieldMerge(), postOnPersist: true, writeBatchDelayMs: 0 });

        await waitFor(() => http.posts.length >= 2, 'the merged row to go out');

        expect(http.posts.at(-1)?.body).toEqual(expect.objectContaining({ updates: [{ id: 't1', title: 'Mine', version: 2 }] }));
    });

    it('takes the server row when the resolver says the server wins', async () => {
        conflictOnce({ ...SERVER, title: 'Theirs', version: 2 });
        const { plugin, store } = await editTitle({ resolveConflict: serverWins() });

        expect(await plugin.syncNow()).toEqual({ sent: 0, failed: 0, rejected: 0, resolved: 1 });
        expect(events).toContainEqual({ type: 'conflict-resolved', collectionName: 'conflictTodos', outcome: 'server' });
        expect(await localRow(store)).toEqual({ ...SERVER, title: 'Theirs', version: 2 });
        expect(await readQueueRows(queueStore)).toEqual([]);
        expect(http.posts).toHaveLength(1);
    });

    it('sends the local row over the server version when the client wins', async () => {
        conflictOnce({ ...SERVER, title: 'Theirs', done: true, version: 2 });
        const { plugin, store } = await editTitle({ resolveConflict: clientWins() });

        await plugin.syncNow();
        await plugin.syncNow();

        expect(await localRow(store)).toEqual({ id: 't1', title: 'Mine', done: false, version: 2 });
        expect(http.posts.at(-1)?.body).toEqual(expect.objectContaining({ updates: [{ id: 't1', title: 'Mine', done: false, version: 2 }] }));
    });

    it('fetches the server row by its key when the 409 does not carry it', async () => {
        conflictOnce(null);
        http.respondToGet(() => ({ status: 200, body: [{ ...SERVER, done: true, version: 2 }] }));
        const { plugin, store } = await editTitle({ resolveConflict: fieldMerge() });
        const gets = http.gets.length;

        await plugin.syncNow();

        expect(http.gets.length).toBe(gets + 1);
        expect(decodeURIComponent(http.gets.at(-1)?.url ?? '')).toContain('t1');
        expect(await localRow(store)).toEqual({ id: 't1', title: 'Mine', done: true, version: 2 });
    });

    it('uses fetchRemote when it is given', async () => {
        conflictOnce(null);
        const fetchRemote = jest.fn(async () => ({ ...SERVER, done: true, version: 3 }));
        const { plugin, store } = await editTitle({ resolveConflict: fieldMerge(), fetchRemote });

        await plugin.syncNow();

        expect(fetchRemote).toHaveBeenCalledWith('conflictTodos', expect.objectContaining({ id: 't1', title: 'Mine' }));
        expect(await localRow(store)).toEqual({ id: 't1', title: 'Mine', done: true, version: 3 });
    });

    it('passes the resolver the values before the edit, the local row and the server row', async () => {
        conflictOnce({ ...SERVER, done: true, version: 2 });
        const resolver = jest.fn<ConflictResolver>(() => null);
        const { plugin } = await editTitle({ resolveConflict: resolver });

        await plugin.syncNow();

        expect(resolver.mock.calls[0]?.[0].base).toStrictEqual({ title: 'Write' });
        expect(resolver).toHaveBeenCalledWith({
            collectionName: 'conflictTodos',
            kind: 'update',
            base: { title: 'Write' },
            local: { id: 't1', title: 'Mine', done: false, version: 1 },
            remote: { id: 't1', title: 'Write', done: true, version: 2 },
        });
    });

    it('keeps the earliest value of a field edited twice before the flush', async () => {
        conflictOnce({ ...SERVER, version: 2 });
        const resolver = jest.fn<ConflictResolver>(() => null);
        const { plugin, store } = await editTitle({ resolveConflict: resolver });
        const todo = await store.todos.firstAsync(x => x.id === 't1');

        todo.title = 'Mine again';
        await store.saveChangesAsync();
        await plugin.syncNow();

        expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ base: { title: 'Write' }, local: expect.objectContaining({ title: 'Mine again' }) }));
    });

    it('leaves the change queued when the resolver defers', async () => {
        conflictOnce({ ...SERVER, version: 2 });
        const { plugin, store } = await editTitle({ resolveConflict: () => ({ defer: true }) });

        expect(await plugin.syncNow()).toEqual({ sent: 0, failed: 1, rejected: 0, resolved: 0 });
        expect(events).toContainEqual({ type: 'conflict-resolved', collectionName: 'conflictTodos', outcome: 'deferred' });
        expect(await localRow(store)).toEqual(expect.objectContaining({ title: 'Mine' }));
        expect(await readQueueRows(queueStore)).toHaveLength(1);
    });

    it('rejects the change when the resolver throws', async () => {
        conflictOnce({ ...SERVER, version: 2 });
        const { plugin } = await editTitle({ resolveConflict: () => { throw new Error('no'); } });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        expect(await plugin.syncNow()).toEqual({ sent: 0, failed: 0, rejected: 1, resolved: 0 });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('resolveConflict threw'), expect.objectContaining({ collectionName: 'conflictTodos' }));
        expect(events).toContainEqual(expect.objectContaining({ type: 'changes-rejected', conflict: true }));
    });

    it('removes the local row when the server no longer has it and the server wins', async () => {
        conflictOnce(null);
        const { plugin, store } = await editTitle({ resolveConflict: fieldMerge() });

        http.respondToGet(() => ({ status: 200, body: [] }));

        await plugin.syncNow();

        expect(await localRow(store)).toBeUndefined();
    });

    it('adds the row again when the server no longer has it and the client wins', async () => {
        conflictOnce(null);
        const { plugin } = await editTitle({ resolveConflict: clientWins(), fetchRemote: async () => null });

        await plugin.syncNow();
        await plugin.syncNow();

        expect(http.posts.at(-1)?.body).toEqual(expect.objectContaining({ adds: [expect.objectContaining({ id: 't1', title: 'Mine' })] }));
    });

    it('sends nothing more when the resolved row already matches the server row', async () => {
        conflictOnce({ ...SERVER, title: 'Mine', version: 2 });
        const { plugin } = await editTitle({ resolveConflict: fieldMerge() });

        await plugin.syncNow();
        await plugin.syncNow();

        expect(http.posts).toHaveLength(1);
        expect(events).toContainEqual({ type: 'conflict-resolved', collectionName: 'conflictTodos', outcome: 'server' });
    });

    it('treats only what isConflict says is a conflict', async () => {
        http.respondToPost(() => ({ status: 412, body: { ...SERVER, version: 2 } }));
        const resolver = jest.fn<ConflictResolver>(() => null);
        const { plugin } = await editTitle({ resolveConflict: resolver, isConflict: failure => failure.kind === 'http' && failure.status === 412 });

        await plugin.syncNow();

        expect(resolver).toHaveBeenCalledTimes(1);
    });

    it('picks the resolver by collection', async () => {
        conflictOnce({ ...SERVER, title: 'Theirs', version: 2 });
        const { plugin, store } = await editTitle({ resolveConflict: byCollection({ conflictTodos: clientWins() }) });

        await plugin.syncNow();

        expect(await localRow(store)).toEqual(expect.objectContaining({ title: 'Mine', version: 2 }));
    });

    it('leaves a 409 to the usual handling when no resolver is set', async () => {
        conflictOnce({ ...SERVER, version: 2 });
        const { plugin, store } = await editTitle({});

        expect(await plugin.syncNow()).toEqual({ sent: 0, failed: 1, rejected: 0, resolved: 0 });
        expect(await localRow(store)).toEqual(expect.objectContaining({ title: 'Mine' }));
        expect(events.some(event => event.type === 'conflict-resolved')).toBe(false);
    });

    const storeReadsDuringSave = async (options: Partial<HttpSwrDbPluginOptions>) => {
        const { plugin, store } = open(options);
        const query = jest.spyOn(Reflect.get(plugin, 'swrStore') as MemoryPlugin, 'query');
        const todo = await store.todos.firstAsync(x => x.id === 't1');
        const before = query.mock.calls.length;

        todo.title = 'Mine';
        await store.saveChangesAsync();

        return query.mock.calls.length - before;
    };

    it('reads the rows before a save when a resolver is set', async () => {
        expect(await storeReadsDuringSave({ resolveConflict: fieldMerge() })).toBe(1);
    });

    it('does not read the rows before a save without a resolver', async () => {
        expect(await storeReadsDuringSave({})).toBe(0);
    });

    it('still queues the save, with no base, when the rows before it cannot be read', async () => {
        conflictOnce({ ...SERVER, version: 2 });
        const resolver = jest.fn<ConflictResolver>(() => null);
        const { plugin, store } = open({ resolveConflict: resolver });
        const todo = await store.todos.firstAsync(x => x.id === 't1');

        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        jest.spyOn(Reflect.get(plugin, 'swrStore') as MemoryPlugin, 'query').mockImplementationOnce((_, done) => done({ ok: 'error', error: new Error('store offline') } as never));
        todo.title = 'Mine';
        await store.saveChangesAsync();
        await plugin.syncNow();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not read the rows before a save'), expect.objectContaining({ eventId: expect.any(String) }));

        expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ base: {}, local: expect.objectContaining({ title: 'Mine' }) }));
    });

    it('leaves a failure that is not a conflict to the usual handling, even with a resolver', async () => {
        http.respondToPost(() => ({ status: 503, body: { ...SERVER, version: 2 } }));
        const resolver = jest.fn<ConflictResolver>(() => null);
        const { plugin } = await editTitle({ resolveConflict: resolver });

        expect(await plugin.syncNow()).toEqual({ sent: 0, failed: 1, rejected: 0, resolved: 0 });
        expect(resolver).not.toHaveBeenCalled();
    });
});
