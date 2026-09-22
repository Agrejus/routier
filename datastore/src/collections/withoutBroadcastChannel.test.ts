import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const schema = s.define('no_broadcast_items', {
    _id: s.string().key().identity(),
    name: s.string(),
}).compile();

class Store extends DataStore {
    items = this.collection(schema).proxy().create();
}

const originalBroadcastChannel = globalThis.BroadcastChannel;
const stores: DataStore[] = [];

const track = (store: Store) => {
    stores.push(store);
    return store;
};

const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 2000;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('condition not met within 2s');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
};

const liveNames = (store: Store) => {
    const deliveries: string[][] = [];
    store.items.subscribe().toArray(result => {
        if (result.ok === 'success') deliveries.push(result.data.map(item => item.name).sort());
    });
    return deliveries;
};

describe('a datastore in a runtime without BroadcastChannel', () => {

    beforeAll(() => {
        Reflect.deleteProperty(globalThis, 'BroadcastChannel');
    });

    afterEach(() => {
        for (const store of stores.splice(0)) store[Symbol.dispose]();
    });

    afterAll(() => {
        globalThis.BroadcastChannel = originalBroadcastChannel;
    });

    it('constructs, saves, and queries', async () => {
        const store = track(new Store(new MemoryPlugin('no-broadcast-basic')));

        await store.items.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        expect(typeof globalThis.BroadcastChannel).toBe('undefined');
        expect((await store.items.toArrayAsync()).map(item => item.name)).toEqual(['first']);
    });

    it('refreshes a live query on the same store after a save', async () => {
        const store = track(new Store(new MemoryPlugin('no-broadcast-live')));
        const deliveries = liveNames(store);
        await waitFor(() => deliveries.length > 0);

        await store.items.addAsync({ name: 'added' });
        await store.saveChangesAsync();

        await waitFor(() => deliveries.some(names => names.includes('added')));
        expect(deliveries[deliveries.length - 1]).toEqual(['added']);
    });

    it('notifies another store over the same database in the same process', async () => {
        const writer = track(new Store(new MemoryPlugin('no-broadcast-shared')));
        const reader = track(new Store(new MemoryPlugin('no-broadcast-shared')));
        const deliveries = liveNames(reader);
        await waitFor(() => deliveries.length > 0);
        const before = deliveries.length;

        await writer.items.addAsync({ name: 'from writer' });
        await writer.saveChangesAsync();

        await waitFor(() => deliveries.length > before);
    });

    it('does not notify a store over a different database', async () => {
        const writer = track(new Store(new MemoryPlugin('no-broadcast-a')));
        const reader = track(new Store(new MemoryPlugin('no-broadcast-b')));
        const deliveries = liveNames(reader);
        await waitFor(() => deliveries.length > 0);
        const before = deliveries.length;

        await writer.items.addAsync({ name: 'elsewhere' });
        await writer.saveChangesAsync();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(deliveries.length).toBe(before);
    });
});
