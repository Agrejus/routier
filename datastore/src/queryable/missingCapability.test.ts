import { describe, expect, it } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * A plugin reporting that its engine cannot express an option.
 *
 * The plugin under test ignores every filter and reports each as a missing capability. Correct rows
 * can only come from the datastore running them over what was returned — which is the whole
 * mechanism, and it needs no new member on `IDbPlugin`. The option is never moved to the memory
 * arm: it keeps `target: "database"` and records what became of it, so a redirect stays
 * distinguishable from something core planned for memory in the first place.
 */

const schema = s.define('handed_back', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

/** Reports every filter as unsupported, then delegates. */
class RefusesFilters implements IDbPlugin {
    constructor(private readonly inner: IDbPlugin) { }

    get databaseName() { return this.inner.databaseName; }

    query<TRoot extends {}, TShape>(event: any, done: any) {
        const filters = event.operation.options.get('filter');

        for (const item of filters) {
            event.operation.options.reportMissingCapability(item);
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

describe('an option the plugin cannot express', () => {

    const refusing = () => new RefusesFilters(new MemoryPlugin(`handed-${uuidv4()}`));

    it('still filters, because the datastore runs what the database did not', async () => {
        const store = await seeded(refusing());
        const found = await store.products.where(p => p.price > 15).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Bravo', 'Charlie']);
    });

    it('applies every unrun filter, not just the first', async () => {
        const store = await seeded(refusing());
        const found = await store.products
            .where(p => p.price > 15)
            .where(p => p.name === 'Bravo')
            .toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    // The unrun filter has to run BEFORE a take that was always going to run in memory, or the
    // window is taken from unfiltered rows
    it('runs an unrun filter ahead of a later option', async () => {
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

    /**
     * The option keeps the arm it was planned for. A redirect is `target: "database"` with a reason
     * that says the database did not run it — which is what tells it apart from something core sent
     * to memory in the first place.
     */
    it('leaves the option on the database arm, and records what became of it', async () => {
        const seen: { target: string, reason: string }[] = [];

        class Recording extends RefusesFilters {
            override query(event: any, done: any) {
                super.query(event, () => {
                    event.operation.options.forEach((option: any) => seen.push({ target: option.target, reason: option.reason }));
                    done({ ok: 'success', data: { value: [] } });
                });
            }
        }

        const store = new Store(new Recording(new MemoryPlugin(`recorded-${uuidv4()}`)) as IDbPlugin);
        await store.products.where(p => p.price > 15).take(1).toArrayAsync().catch(() => undefined);

        expect(seen).toEqual([
            { target: 'database', reason: 'missing-capability' },
            { target: 'database', reason: 'not-reached' },
        ]);
    });

    // A query that was pure-database takes the memory branch for the first time when the plugin
    // cannot express something, and that branch is where change tracking is attached
    it('still tracks changes on entities returned through the memory branch', async () => {
        const store = await seeded(refusing());
        const [found] = await store.products.where(p => p.price === 30).toArrayAsync();

        expect(found.name).toBe('Bravo');

        found.name = 'Bravo edited';
        await store.saveChangesAsync();

        const [reread] = await store.products.where(p => p.price === 30).toArrayAsync();

        expect(reread.name).toBe('Bravo edited');
    });
});
