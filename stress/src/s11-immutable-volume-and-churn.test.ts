import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { contractProductSchema } from '@routier/test-utils';
import {
    MemoryTrace,
    Oracle,
    cleanupBackendArtifacts,
    compareToOracle,
    describeComparison,
    memoryBackend,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S11 — S1's volume and S3's churn, run through an `.immutable()` collection.
 *
 * The immutable path has unit coverage (`ImmutableCollection.test.ts`) and a real-database
 * round trip (`e2e/src/sqliteJsonColumns.test.ts`), but until now it had never carried a
 * volume or churn workload. Those find different things: a per-row cost that is fine once
 * and ruinous a hundred thousand times, and state that accumulates a little per cycle.
 *
 * It has specific reasons to be suspicious, all of them new:
 *
 *  - **Every update allocates.** `update()` snapshots a base with `schema.clone` the first
 *    time it touches a row and builds a new object per patch. At volume that is real
 *    allocation pressure, and the churn half of this scenario is where a leak would show.
 *  - **Reads adopt rather than merge.** Each re-read replaces the canonical attachment. A
 *    map that grows per read instead of replacing an entry leaks in exactly the shape S3
 *    was built to catch.
 *  - **`mergeChanges` adopts for `update()`-changed rows.** A newer code path than the
 *    merge one, and the one that keeps the pending map and the attachment map agreeing.
 */

const VOLUME = 100_000;
const ADD_BATCH = 1_000;
const MIXED_BATCHES = 20;

const CHURN_ENTITIES = 1_000;
const CHURN_CYCLES = 5_000;
const CHURN_SUBSET = 50;
const RECONCILE_EVERY = 500;
const SAMPLE_EVERY = 250;

class ImmutableProductStore extends DataStore {
    products: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.products = this.collection(schema).immutable().create();
    }
}

type Product = { _id: string; name: string; category: string; price: number };

const keyOf = (p: Product) => p._id;

const snapshot = (p: Product): Product => ({ _id: p._id, name: p.name, category: p.category, price: p.price });

const stores: ImmutableProductStore[] = [];

const openStore = () => {
    const store = new ImmutableProductStore(memoryBackend.create(), contractProductSchema);
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S11 immutable collection under volume and churn', () => {
    stressIt(
        `memory: ${VOLUME.toLocaleString('en-US')} adds then mixed churn, all writes through update()`,
        {
            seed: 20260811,
            scale: {
                backend: memoryBackend.name,
                mode: 'immutable',
                entities: VOLUME,
                addBatchSize: ADD_BATCH,
                mixedBatches: MIXED_BATCHES,
            },
        },
        async ({ rng, note }) => {
            const store = openStore();
            const oracle = new Oracle<Product>(keyOf);

            let next = 0;
            const newProduct = () => {
                const n = next++;
                return { name: `product-${n}`, category: `category-${n % 25}`, price: n % 1000 };
            };

            for (let batch = 0; batch * ADD_BATCH < VOLUME; batch++) {
                const size = Math.min(ADD_BATCH, VOLUME - batch * ADD_BATCH);
                const added = await store.products.addAsync(...Array.from({ length: size }, newProduct));
                const result = await store.saveChangesAsync();

                expect(result.aggregate.adds).toBe(size);

                added.forEach((entity: Product) => oracle.set(snapshot(entity)));

                const count = await store.products.countAsync();

                if (count !== oracle.size) {
                    note(`diverged at add batch ${batch}`);
                }

                expect(count).toBe(oracle.size);
            }

            expect(oracle.size).toBe(VOLUME);

            const rows = (await store.products.toArrayAsync()) as Product[];

            expect(rows.length).toBe(VOLUME);
            // Reads are frozen, which is the property the whole mode rests on. Checking it at
            // volume rather than on one entity catches a freeze that only fires on the first page.
            expect(Object.isFrozen(rows[0])).toBe(true);
            expect(Object.isFrozen(rows[rows.length - 1])).toBe(true);

            const live = new Map(rows.map(r => [keyOf(r), r]));

            for (let batch = 0; batch < MIXED_BATCHES; batch++) {
                const available = [...live.values()];
                const targets = rng.sample(available, 100);
                const toUpdate = targets.slice(0, 50);
                const toRemove = targets.slice(50);

                for (const row of toUpdate) {
                    // Written through the reference held since the first read, which is stale
                    // from batch 2 onward.
                    store.products.update(row, { price: 10_000 + batch, category: `churned-${batch}` });
                }

                await store.products.removeAsync(...toRemove);
                const added = await store.products.addAsync(...Array.from({ length: 25 }, newProduct));
                const result = await store.saveChangesAsync();

                expect({
                    adds: result.aggregate.adds,
                    updates: result.aggregate.updates,
                    removes: result.aggregate.removes,
                }).toEqual({ adds: 25, updates: toUpdate.length, removes: toRemove.length });

                toUpdate.forEach(row => {
                    const current = store.products.current(row) as Product;
                    oracle.set(snapshot(current));
                    live.set(keyOf(current), current);
                });
                toRemove.forEach(row => { oracle.delete(keyOf(row)); live.delete(keyOf(row)); });
                added.forEach((entity: Product) => {
                    oracle.set(snapshot(entity));
                    live.set(keyOf(entity), entity);
                });

                expect(await store.products.countAsync()).toBe(oracle.size);
            }

            const final = (await store.products.toArrayAsync()) as Product[];
            const comparison = compareToOracle(oracle, final, keyOf, { fields: ['name', 'category', 'price'] });

            note(describeComparison(comparison));

            expect(comparison.matches ? 'oracle matches' : describeComparison(comparison)).toBe('oracle matches');
        }
    );

    stressIt(
        `memory: ${CHURN_CYCLES.toLocaleString('en-US')} update() cycles leave no residue`,
        {
            seed: 20260812,
            scale: {
                backend: memoryBackend.name,
                mode: 'immutable',
                entities: CHURN_ENTITIES,
                cycles: CHURN_CYCLES,
                subsetPerCycle: CHURN_SUBSET,
            },
        },
        async ({ rng, note }) => {
            const store = openStore();
            const trace = new MemoryTrace();
            const oracle = new Oracle<Product>(keyOf);

            await store.products.addAsync(
                ...Array.from({ length: CHURN_ENTITIES }, (_, i) => ({
                    name: `p${i}`, category: `c${i % 25}`, price: i,
                }))
            );
            await store.saveChangesAsync();

            ((await store.products.toArrayAsync()) as Product[]).forEach(r => oracle.set(snapshot(r)));

            expect(oracle.size).toBe(CHURN_ENTITIES);

            const reconcile = async (cycle: number) => {
                const actual = (await store.products.toArrayAsync()) as Product[];
                const comparison = compareToOracle(oracle, actual, keyOf, { fields: ['name', 'category', 'price'] });

                if (comparison.matches === false) {
                    note(`first divergence at cycle ${cycle}`);
                    note(describeComparison(comparison));
                }

                expect(comparison.matches ? 'oracle matches' : describeComparison(comparison)).toBe('oracle matches');
            };

            for (let cycle = 0; cycle < CHURN_CYCLES; cycle++) {
                // Re-reading every cycle is the point: each read ADOPTS a new canonical, so a
                // per-read leak in the attachment map shows here and nowhere else.
                const page = (await store.products.toArrayAsync()) as Product[];

                for (const row of rng.sample(page, CHURN_SUBSET)) {
                    store.products.update(row, (prev: Product) => ({
                        ...prev,
                        price: prev.price + 1,
                        category: `gen${cycle}`,
                    }));
                }

                await store.saveChangesAsync();

                const stillDirty = await store.hasChangesAsync();

                if (stillDirty) {
                    note(`store still reported changes after the save in cycle ${cycle}`);
                }

                expect(stillDirty).toBe(false);

                ((await store.products.toArrayAsync()) as Product[]).forEach(r => oracle.set(snapshot(r)));

                if (cycle % SAMPLE_EVERY === 0) {
                    trace.sample(cycle);
                }

                if (cycle > 0 && cycle % RECONCILE_EVERY === 0) {
                    await reconcile(cycle);
                }
            }

            trace.sample(CHURN_CYCLES);
            await reconcile(CHURN_CYCLES);

            const verdict = trace.verdict();

            note(verdict.report);

            expect(verdict.leaking ? verdict.report : 'growth decays').toBe('growth decays');
        }
    );
});
