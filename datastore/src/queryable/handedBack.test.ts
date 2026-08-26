import { describe, expect, it } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * A plugin handing an option back, because its engine cannot express it.
 *
 * The plugin under test deliberately ignores every filter and hands them back. Correct rows can only
 * come from the datastore running them over what was returned — which is the whole mechanism, and it
 * needs no new member on `IDbPlugin`: the option already carries a target, and the plugin flips it.
 */

const schema = s.define('handed_back', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

/** Hands every filter back, then delegates with the filters removed. */
class RefusesFilters implements IDbPlugin {
    constructor(private readonly inner: IDbPlugin) { }

    get databaseName() { return this.inner.databaseName; }

    query<TRoot extends {}, TShape>(event: any, done: any) {
        const filters = event.operation.options.get('filter');

        for (const item of filters) {
            event.operation.options.deferToMemory(item, 'unsupported-by-plugin');
        }

        this.inner.query(event, done);
    }

    destroy(event: any, done: any) { this.inner.destroy(event, done); }
    bulkPersist(event: any, done: any) { this.inner.bulkPersist(event, done); }
}

class Store extends DataStore {
    products = this.collection(schema).proxy().create();
}

const seeded = async (plugin: IDbPlugin) => {
    const store = new Store(plugin);
    await store.products.addAsync(
        { name: 'Alpha', price: 10 } as never,
        { name: 'Bravo', price: 30 } as never,
        { name: 'Charlie', price: 20 } as never,
    );
    await store.saveChangesAsync();

    return store;
};

describe('an option the plugin hands back', () => {

    const refusing = () => new RefusesFilters(new MemoryPlugin(`handed-${uuidv4()}`));

    it('still filters, because the datastore runs what was handed back', async () => {
        const store = await seeded(refusing());
        const found = await store.products.where(p => p.price > 15).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Bravo', 'Charlie']);
    });

    it('applies every handed-back filter, not just the first', async () => {
        const store = await seeded(refusing());
        const found = await store.products
            .where(p => p.price > 15)
            .where(p => p.name === 'Bravo')
            .toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    // The handed-back filter has to run BEFORE a take that was always going to run in memory,
    // or the window is taken from unfiltered rows
    it('runs a handed-back filter ahead of a later option', async () => {
        const store = await seeded(refusing());
        const found = await store.products.where(p => p.price > 15).take(1).toArrayAsync();

        expect(found).toHaveLength(1);
        expect(['Bravo', 'Charlie']).toContain(found[0].name);
    });

    it('leaves a plugin that handles its filters alone', async () => {
        const store = await seeded(new MemoryPlugin(`handled-${uuidv4()}`));
        const found = await store.products.where(p => p.price > 15).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Bravo', 'Charlie']);
    });
});
