import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const schema = s.define('sub_scratch', {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

class Store extends DataStore {
    products = this.collection(schema).proxy().create();
}

const stores: DataStore[] = [];
afterEach(() => { for (const st of stores.splice(0)) st[Symbol.dispose](); });

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Guards the fix for defect #24: a filtered subscription's match-check saw only a changed
 * row's NEW value, so an update that made a row STOP matching the where clause never
 * notified the subscriber — its callback kept the stale array forever, while a DELETE of
 * the same row (matched by old content) did notify. The bridge now also re-queries when a
 * changed row's id is in the subscriber's last delivered result set.
 */
describe('filtered subscription vs one-shot reader', () => {
    it('fires with the FULL result set when a change matches the filter', async () => {
        const store = new Store(new MemoryPlugin(`sub-${Math.random()}`));
        stores.push(store);

        await store.products.addAsync({ name: 'a', price: 60 } as any, { name: 'b', price: 70 } as any);
        await store.saveChangesAsync();

        const deliveries: any[] = [];
        const unsubscribe = store.products.subscribe().where(p => p.price > 50).toArray(r => {
            if (r.ok !== 'error') deliveries.push(r.data);
        });

        await wait(300); // initial delivery

        // Component A: one-shot read, then mutate through the reference
        const itemA = await store.products.firstAsync(p => p.name === 'a');
        (itemA as any).price = 65;
        await store.saveChangesAsync();

        await wait(300);
        unsubscribe();

        expect(deliveries.length).toBe(2); // initial + the save
        // The delivery is the whole re-queried result set, not just the changed item
        expect(deliveries[1].map((x: any) => x.name).sort()).toEqual(['a', 'b']);
    });

    it('fires when an update makes an item LEAVE the result set', async () => {
        const store = new Store(new MemoryPlugin(`sub-${Math.random()}`));
        stores.push(store);

        await store.products.addAsync({ name: 'a', price: 60 } as any, { name: 'b', price: 70 } as any);
        await store.saveChangesAsync();

        const deliveries: any[] = [];
        const unsubscribe = store.products.subscribe().where(p => p.price > 50).toArray(r => {
            if (r.ok !== 'error') deliveries.push(r.data);
        });

        await wait(300);

        // 'a' drops OUT of the price > 50 result set — the case the old match-check missed
        const itemA = await store.products.firstAsync(p => p.name === 'a');
        (itemA as any).price = 10;
        await store.saveChangesAsync();

        await wait(300);
        unsubscribe();

        // The subscriber's view changed (a disappeared), so it must be told
        expect(deliveries.length).toBe(2);
        expect(deliveries[1].map((x: any) => x.name)).toEqual(['b']);
    });
});

describe('noise guard', () => {
    it('does not fire for an update to a row that was not, and still is not, in the set', async () => {
        const store = new Store(new MemoryPlugin(`sub-${Math.random()}`));
        stores.push(store);

        await store.products.addAsync({ name: 'a', price: 60 } as any, { name: 'c', price: 10 } as any);
        await store.saveChangesAsync();

        const deliveries: any[] = [];
        const unsubscribe = store.products.subscribe().where(p => p.price > 50).toArray(r => {
            if (r.ok !== 'error') deliveries.push(r.data);
        });

        await wait(300);

        // 'c' was never in the subscriber's set and stays out of it
        const itemC = await store.products.firstAsync(p => p.name === 'c');
        (itemC as any).price = 20;
        await store.saveChangesAsync();

        await wait(300);
        unsubscribe();

        expect(deliveries.length).toBe(1); // the initial delivery only
    });
});
