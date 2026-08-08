import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * Auditing, declared on the collection and shaped by `derive`.
 *
 * The history table's shape is deliberately not one the library could have guessed — renamed
 * fields, the delta stored as text — because the whole point is that nothing about the row is
 * decided for the caller.
 */

const productSchema = s.define('audited_products', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

const historySchema = s.define('audited_history', {
    id: s.string().key().identity(),
    what: s.string(),
    how: s.string(),
    changed: s.string(),
    when: s.date(),
}).compile();

class Store extends DataStore {
    history = this.collection(historySchema).proxy().create();

    products = this.collection(productSchema)
        .audit(historySchema)
        .derive((changes, cb) => {
            cb(changes.map(change => ({
                what: change.collection,
                how: change.operation,
                changed: JSON.stringify(change.delta ?? {}),
                when: change.at,
            })));
        })
        .proxy()
        .create();
}

/** Records one summary row per save rather than one per change. */
class SummaryStore extends DataStore {
    history = this.collection(historySchema).proxy().create();

    products = this.collection(productSchema)
        .audit(historySchema)
        .derive((changes, cb) => {
            cb([{ what: 'batch', how: `${changes.length} changes`, changed: '{}', when: changes[0].at }]);
        })
        .proxy()
        .create();
}

/** Records nothing at all — never calls the callback. */
class SilentStore extends DataStore {
    history = this.collection(historySchema).proxy().create();

    products = this.collection(productSchema)
        .audit(historySchema)
        .derive(() => undefined)
        .proxy()
        .create();
}

const stores: DataStore[] = [];

const open = <T extends DataStore>(Ctor: new (plugin: MemoryPlugin) => T): T => {
    const store = new Ctor(new MemoryPlugin(`audit-${uuidv4()}`));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('collection.audit().derive()', () => {

    it('records an add', async () => {
        const store = open(Store);

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync();

        expect(rows).toHaveLength(1);
        expect(rows[0].what).toBe('audited_products');
        expect(rows[0].how).toBe('add');
    });

    it('records an update with its delta', async () => {
        const store = open(Store);

        const [product] = await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        product.price = 2;
        await store.saveChangesAsync();

        const rows = await store.history.where(h => h.how === 'update').toArrayAsync();

        expect(rows).toHaveLength(1);
        expect(JSON.parse(rows[0].changed)).toMatchObject({ price: 2 });
    });

    it('records a removal', async () => {
        const store = open(Store);

        const [product] = await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        expect(await store.history.where(h => h.how === 'remove').countAsync()).toBe(1);
    });

    it('hands derive the whole batch for one save', async () => {
        const store = open(SummaryStore);

        await store.products.addAsync({ name: 'a', price: 1 } as any, { name: 'b', price: 2 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync();

        // Two changes, one row: collapsing is only possible because derive gets the batch
        // rather than being called once per change.
        expect(rows).toHaveLength(1);
        expect(rows[0].how).toBe('2 changes');
    });

    it('records nothing when derive never emits', async () => {
        const store = open(SilentStore);

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        expect(await store.history.countAsync()).toBe(0);
    });

    it('reports only the caller\'s own changes in the save result', async () => {
        const store = open(Store);

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        const result = await store.saveChangesAsync();

        // The audit row rides the same save, but the caller did not add it.
        expect(result.aggregate.adds).toBe(1);
    });

    it('leaves the audit collection usable in the same store', async () => {
        const store = open(Store);

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        // Reading it is the point of it being an ordinary table. Its change tracker never
        // submitted the audit rows, so they must not reach its afterPersist.
        expect(await store.history.countAsync()).toBe(1);

        // And it still works as a normal collection.
        await store.history.addAsync({ what: 'manual', how: 'note', changed: '{}', when: new Date() } as any);
        await store.saveChangesAsync();

        expect(await store.history.countAsync()).toBe(2);
    });

    it('does not audit a save that changed nothing on the collection', async () => {
        const store = open(Store);

        await store.saveChangesAsync();

        expect(await store.history.countAsync()).toBe(0);
    });

    it('stamps every change in a save with one instant', async () => {
        const store = open(Store);

        await store.products.addAsync({ name: 'a', price: 1 } as any, { name: 'b', price: 2 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync();
        const instants = new Set(rows.map(r => r.when.getTime()));

        expect(rows).toHaveLength(2);
        expect(instants.size).toBe(1);
    });
});
