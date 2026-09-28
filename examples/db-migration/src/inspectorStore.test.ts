import { afterAll, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { ShopStore } from './store';
import { inspectorDatabaseName, openInspectorStore, seedInspectorStore } from './inspectorStore';

const stores: ShopStore[] = [];

const open = (name: string) => {
    const store = new ShopStore(new MemoryPlugin(name));
    stores.push(store);
    return store;
};

const orderIds = async (store: ShopStore) => (await store.orders.map(order => order._id).toArrayAsync()).sort();

afterAll(async () => {
    await Promise.all(stores.map(store => store.destroyAsync()));
});

describe('inspectorDatabaseName', () => {
    it('is the same on every visit, so a repeat visit reuses its database', () => {
        expect(inspectorDatabaseName('pglite')).toBe('inspector-pglite');
        expect(inspectorDatabaseName('pglite')).toBe(inspectorDatabaseName('pglite'));
    });
});

describe('seedInspectorStore', () => {
    it('seeds an empty database with the requested rows', async () => {
        const store = open(uuidv4());

        await seedInspectorStore(store, 50);

        expect(await store.orders.countAsync()).toBe(50);
    });

    it('reuses a database a previous visit seeded, without writing it again', async () => {
        const name = uuidv4();
        await seedInspectorStore(open(name), 50);
        const before = await orderIds(open(name));

        const second = open(name);
        await seedInspectorStore(second, 50);

        expect(await orderIds(second)).toEqual(before);
    });

    it('replaces a database holding a different number of rows', async () => {
        const name = uuidv4();
        await seedInspectorStore(open(name), 30);

        const second = open(name);
        await seedInspectorStore(second, 50);

        expect(await second.orders.countAsync()).toBe(50);
    });

    it('seeds across several batches', async () => {
        const store = open(uuidv4());

        await seedInspectorStore(store, 2100);

        expect(await store.orders.countAsync()).toBe(2100);
    });

    it('returns the same query context whether it seeded or reused the database', async () => {
        const name = uuidv4();
        const first = await seedInspectorStore(open(name), 50);
        const second = await seedInspectorStore(open(name), 50);

        expect(second.context).toEqual(first.context);
        expect(first.context.email).toMatch(/@/);
    });
});

describe('openInspectorStore', () => {
    it('opens the engine under its stable name and reuses it on the next open', async () => {
        const first = await openInspectorStore('memory', 40);
        stores.push(first.store);
        const before = await orderIds(first.store);

        const second = await openInspectorStore('memory', 40);
        stores.push(second.store);

        expect(await second.store.orders.countAsync()).toBe(40);
        expect(await orderIds(second.store)).toEqual(before);
    });
});
