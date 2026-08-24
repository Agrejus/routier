import { describe, it, expect, afterAll } from '@jest/globals';
import { s } from '@routier/core/schema';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { PouchDbPlugin } from '../PouchDbPlugin';
import { TestDataStore } from './datastore/PouchDbDatastore';

const pluginFactory: () => IDbPlugin = () => new PouchDbPlugin(uuidv4());

// The shape an app not written for PouchDB has: a plain `id` key instead of `_id`.
// PouchDB can neither store nor return such a key, so the plugin must refuse it —
// silently accepting it reads every entity back with an undefined key and the change
// tracker merges them all into one.
const plainIdSchema = s.define('orders', {
    id: s.string().key().identity(),
    status: s.string('pending', 'paid'),
    total: s.number(),
}).compile();

const orderSchema = s.define('orders', {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    status: s.string('pending', 'paid'),
    region: s.string('us-east', 'eu'),
    total: s.number(),
    createdAt: s.date(),
}).compile();

class PlainIdStore extends DataStore {
    orders = this.collection(plainIdSchema).proxy().create();
}

class OrderStore extends DataStore {
    orders = this.collection(orderSchema).proxy().create();
}

const stores: DataStore[] = [];
const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

describe('reads after an aggregate', () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    it('toArrayAsync returns distinct entities after a filtered sumAsync', async () => {
        const dataStore = track(new TestDataStore(pluginFactory()));

        await dataStore.products.addAsync(...Array.from({ length: 50 }, (_, i) => ({
            name: `product-${i}`,
            price: i + 1,
            category: i % 2 === 0 ? 'even' : 'odd',
            inStock: true,
            tags: ['computer' as const],
        })));
        await dataStore.saveChangesAsync();

        const sum = await dataStore.products
            .where(([x, p]) => x.category === p.category, { category: 'even' })
            .sumAsync(x => x.price);

        expect(sum).toBeGreaterThan(0);

        const all = await dataStore.products.toArrayAsync();

        expect(all.length).toBe(50);
        expect(new Set(all.map(x => x._id)).size).toBe(50);
        expect(all[0]).not.toBe(all[1]);
    });

    it('refuses a schema whose key is not _id instead of corrupting reads', async () => {
        const dataStore = track(new PlainIdStore(pluginFactory()));

        await dataStore.orders.addAsync({ status: 'paid', total: 10 });

        await expect(dataStore.saveChangesAsync()).rejects.toThrow(/identity keys as '_id'/);
    });

    it('toArrayAsync returns distinct entities after the full benchmark op sequence', async () => {
        const dataStore = track(new OrderStore(pluginFactory()));
        const count = 2000;

        // Batched saves, exactly like a bulk import.
        const orders = Array.from({ length: count }, (_, i) => ({
            status: i % 2 === 0 ? 'paid' as const : 'pending' as const,
            region: i % 3 === 0 ? 'eu' as const : 'us-east' as const,
            total: (i % 999) + 1,
            createdAt: new Date(2024, 0, 1 + (i % 900)),
        }));
        for (let i = 0; i < orders.length; i += 1000) {
            await dataStore.orders.addAsync(...orders.slice(i, i + 1000));
            await dataStore.saveChangesAsync();
        }

        expect(await dataStore.orders.countAsync()).toBe(count);
        expect((await dataStore.orders.toArrayAsync()).length).toBe(count);
        expect((await dataStore.orders
            .where(([x, p]) => x.status === p.status && x.region === p.region, { status: 'pending', region: 'eu' })
            .toArrayAsync()).length).toBeGreaterThan(0);
        expect((await dataStore.orders
            .sortDescending(x => x.createdAt)
            .skip(1000)
            .take(25)
            .toArrayAsync()).length).toBe(25);

        const sum = await dataStore.orders
            .where(([x, p]) => x.status === p.status, { status: 'paid' })
            .sumAsync(x => x.total);

        expect(sum).toBeGreaterThan(0);

        const all = await dataStore.orders.toArrayAsync();

        expect(all.length).toBe(count);
        expect(new Set(all.map(x => x._id)).size).toBe(count);
    });
});
