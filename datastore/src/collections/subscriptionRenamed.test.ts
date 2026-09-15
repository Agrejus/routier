import { afterEach, describe, expect, it } from '@jest/globals';
import { IDbPlugin } from '@routier/core';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const schema = s.define('sub_renamed', {
    _id: s.string().key(),
    label: s.string().from('wire_label'),
    amount: s.number(),
}).compile();

/** Counts the queries that reach the real plugin, which is what a subscription's change probe exists to save. */
class CountingPlugin implements IDbPlugin {
    queries = 0;

    constructor(private readonly inner: IDbPlugin) { }

    get databaseName() { return this.inner.databaseName; }

    query(event: any, done: any) {
        this.queries++;
        this.inner.query(event, done);
    }

    destroy(event: any, done: any) { this.inner.destroy(event, done); }
    bulkPersist(event: any, done: any) { this.inner.bulkPersist(event, done); }
}

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const stores: DataStore[] = [];
afterEach(() => { for (const st of stores.splice(0)) st[Symbol.dispose](); });

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const seeded = async () => {
    const plugin = new CountingPlugin(new MemoryPlugin(`sub-renamed-${Math.random()}`));
    const store = new Store(plugin);
    stores.push(store);

    await store.rows.addAsync({ _id: 'r1', label: 'alpha', amount: 1 } as any, { _id: 'r2', label: 'bravo', amount: 2 } as any);
    await store.saveChangesAsync();

    return { plugin, store };
};

/**
 * A live query filtering on a property stored under a `.from()` name.
 *
 * The change probe is seeded with rows the broadcast has already deserialized, so they carry the
 * in-memory names. A probe that reported the rename, as a plugin over stored rows must, handed
 * every seeded row back unfiltered and every change re-queried the real plugin.
 */
describe('a subscription filtered on a renamed property', () => {
    it('delivers the matching rows when a change matches', async () => {
        const { store } = await seeded();

        const deliveries: any[] = [];
        const unsubscribe = store.rows.subscribe().where(r => r.label === 'bravo').toArray(r => {
            if (r.ok !== 'error') deliveries.push(r.data);
        });

        await wait(300);

        await store.rows.addAsync({ _id: 'r3', label: 'bravo', amount: 3 } as any);
        await store.saveChangesAsync();

        await wait(300);
        unsubscribe();

        expect(deliveries.length).toBe(2);
        expect(deliveries[1].map((x: any) => x._id).sort()).toEqual(['r2', 'r3']);
    });

    it('does not re-query for a change the filter excludes', async () => {
        const { plugin, store } = await seeded();

        const deliveries: any[] = [];
        const unsubscribe = store.rows.subscribe().where(r => r.label === 'bravo').toArray(r => {
            if (r.ok !== 'error') deliveries.push(r.data);
        });

        await wait(300);
        const before = plugin.queries;

        await store.rows.addAsync({ _id: 'r4', label: 'zulu', amount: 4 } as any);
        await store.saveChangesAsync();

        await wait(300);
        unsubscribe();

        expect(plugin.queries).toBe(before);
        expect(deliveries.length).toBe(1);
    });
});
