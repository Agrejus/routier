import { describe, expect, it } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { Query, QueryOptionsCollection } from '@routier/core/plugins';
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

const tagSchema = s.define('handed_back_tags', {
    id: s.string().key().identity(),
    productId: s.string(),
    label: s.string(),
}).compile();

/**
 * Reports every filter as unsupported, then runs only what it still owns.
 *
 * Running the rest would be wrong, and this is the contract a real plugin has to keep: once it
 * reports, everything at or after that option is core's to run. A plugin that reported a filter and
 * then performed the join anyway would return tuples while core believed the join had not happened,
 * and core would join them a second time.
 */
class RefusesFilters implements IDbPlugin {
    constructor(private readonly inner: IDbPlugin) { }

    get databaseName() { return this.inner.databaseName; }

    query<TRoot extends {}, TShape>(event: any, done: any) {
        const options = event.operation.options;

        // This collection's own filters only. Core generates a key filter for a join's inner read,
        // and refusing that would be refusing core's plumbing, not reporting a capability gap.
        if (event.operation.schema.collectionName === schema.collectionName) {
            for (const item of options.get('filter')) {
                options.reportMissingCapability(item);
            }
        }

        // Runs only what it still owns. A plugin that reported a filter and then performed the join
        // anyway would return tuples while core believed the join had not happened, and core would
        // join them a second time.
        const executed = new QueryOptionsCollection<any>();

        options.forEach((option: any) => {
            if (option.target === 'database' && option.reason === 'executed') {
                executed.add(option.name, option.value);
            }
        });

        this.inner.query({ ...event, operation: new Query(executed as never, event.operation.schema) }, done);
    }

    destroy(event: any, done: any) { this.inner.destroy(event, done); }
    bulkPersist(event: any, done: any) { this.inner.bulkPersist(event, done); }
}

class Store extends DataStore {
    products = this.collection(schema).proxy().create();
    tags = this.collection(tagSchema).proxy().create();
}

const seeded = async (plugin: IDbPlugin) => {
    const store = new Store(plugin);
    await store.products.addAsync(
        { name: 'Alpha', price: 10 } as never,
        { name: 'Bravo', price: 30 } as never,
        { name: 'Charlie', price: 20 } as never,
    );
    await store.saveChangesAsync();

    const products = await store.products.toArrayAsync();

    for (const product of products) {
        await store.tags.addAsync({ productId: product.id, label: `tag-${product.name}` } as never);
    }

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

    /**
     * The join branch is reached BEFORE the memory pass used to be computed, so an option the plugin
     * could not run was neither run by the database nor replayed here — it was dropped, and the query
     * returned every row with no error.
     */
    it('runs an unrun filter on a joined query, which takes a different branch entirely', async () => {
        const store = await seeded(refusing());
        const pairs = await store.products
            .where(p => p.price > 15)
            .join(s => s.tags, p => p.id, t => t.productId)
            .toArrayAsync();

        const outerNames = pairs.map(([product]) => product.name).sort();

        expect(outerNames).toEqual(["Bravo", "Charlie"]);
    });


});


/**
 * A plugin whose capability can change between dispatches.
 *
 * It decides what to RUN from its own capability, never from `reason` — which is what a real plugin
 * does, and what makes a stale report observable: reading `reason` to decide would make the plugin
 * self-correct and hide the bug.
 */
class LosesCapability implements IDbPlugin {
    private dispatches = 0;

    constructor(private readonly inner: IDbPlugin, private readonly optionName: string, private readonly regainsAfterFirst: boolean) { }

    get databaseName() { return this.inner.databaseName; }

    query<TRoot extends {}, TShape>(event: any, done: any) {
        const options = event.operation.options;
        const mine = event.operation.schema.collectionName === schema.collectionName;

        if (mine) {
            this.dispatches++;
        }

        const canDo = this.regainsAfterFirst === true && this.dispatches > 1;
        const runnable = new QueryOptionsCollection<any>();

        options.forEach((option: any) => {
            if (option.target !== 'database') {
                return;
            }

            if (mine && option.name === this.optionName && canDo === false) {
                return;
            }

            runnable.add(option.name, option.value);
        });

        if (mine && canDo === false) {
            for (const item of options.get(this.optionName)) {
                options.reportMissingCapability(item);
            }
        }

        this.inner.query({ ...event, operation: new Query(runnable as never, event.operation.schema) }, done);
    }

    destroy(event: any, done: any) { this.inner.destroy(event, done); }
    bulkPersist(event: any, done: any) { this.inner.bulkPersist(event, done); }
}

describe('a report from a previous execution', () => {

    const stores: Store[] = [];

    afterAll(async () => {
        await Promise.all(stores.splice(0).map(s => s.destroyAsync().catch(() => undefined)));
    });

    const seededWith = async (plugin: IDbPlugin) => {
        const store = new Store(plugin);
        stores.push(store);
        await store.products.addAsync(
            { name: 'Alpha', price: 10 } as never,
            { name: 'Bravo', price: 30 } as never,
            { name: 'Charlie', price: 20 } as never,
        );
        await store.saveChangesAsync();
        return store;
    };

    /**
     * Run one cannot window and reports it; run two can. The report is mutated in place on items the
     * snapshot shares, so without forgetting it the second run windows in the plugin AND again in
     * memory — three rows become one.
     */
    it('is not carried into the next terminal on the same queryable', async () => {
        const store = await seededWith(new LosesCapability(new MemoryPlugin(`stale-${uuidv4()}`), 'skip', true));
        const query = store.products.skip(1);

        expect((await query.toArrayAsync()).length).toBe(2);
        // Applied twice this is 1, which is what a report left over from the first run produces
        expect((await query.toArrayAsync()).length).toBe(2);
    });
});
