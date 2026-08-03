import { afterAll, afterEach, expect } from '@jest/globals';
import { IDbPlugin } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { contractProductSchema } from '@routier/test-utils';
import {
    ALL_BACKENDS,
    Backend,
    Oracle,
    cleanupBackendArtifacts,
    compareToOracle,
    describeComparison,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S1 — volume through one store and one collection.
 *
 * The functional suite proves a save works. This asks whether a hundred thousand of them
 * still agree with each other. Three failure modes only appear at this scale:
 *
 *  - **Silent drops in mixed saves.** A batch carrying adds, updates, and removes at once
 *    routes each kind down a different branch of the persist pipeline. A branch that
 *    loses an entity costs one row out of a thousand — invisible to a three-entity test,
 *    fatal to a real database.
 *  - **Id collisions.** Generated identities are unique until they are not. Two entities
 *    sharing an id is unobservable at small counts and unrecoverable at large ones, so
 *    the comparison reports duplicates instead of deduplicating them.
 *  - **Aggregate misreporting.** `result.aggregate` is what a caller uses to decide
 *    whether a save did what it asked. If it drifts from the truth, every downstream
 *    decision built on it is wrong, and nothing else in the system will say so.
 *
 * Schema choice: `contractProductSchema` from the plugin contract kit. It is strings and
 * numbers only, which is the intersection all three backends hold natively — SQLite has
 * no boolean or date column type and declines rich types in its own contract run. Richer
 * shapes are S2's job, on the backends that can store them. Its key is `identity()`, so
 * the store assigns ids and the collision hunt above is live rather than theoretical.
 */

class ProductStore extends DataStore {
    products = this.collection(contractProductSchema).create();
}

type Product = { _id: string; name: string; category: string; price: number };

const keyOf = (product: Product) => product._id;

/** Plain snapshots, detached from the tracked proxies the store handed back. */
const snapshot = (product: Product): Product => ({
    _id: product._id,
    name: product.name,
    category: product.category,
    price: product.price,
});

const stores: { store: ProductStore; plugin: IDbPlugin }[] = [];

const openStore = (backend: Backend) => {
    const plugin = backend.create();
    const store = new ProductStore(plugin);
    stores.push({ store, plugin });
    return store;
};

afterEach(async () => {
    // Every store is destroyed, not merely dropped. A SQLite handle or a subscription
    // channel left open keeps the event loop alive and turns the next scenario's timing
    // into somebody else's problem.
    for (const { store } of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

/**
 * Scales the whole scenario off one number so a backend's budget (see backends.ts) sets
 * every phase consistently. The spec's shape at the memory budget of 100k: 1k-entity add
 * batches, then 10k updates and 10k removals spread over mixed batches.
 */
const planFor = (budget: number) => ({
    adds: budget,
    addBatchSize: Math.max(1, Math.round(budget / 100)),
    mixedBatches: 20,
    /** Per mixed batch, of each kind. Updates and removes each total budget/10. */
    updatesPerBatch: Math.max(1, Math.round(budget / 10 / 20)),
    removesPerBatch: Math.max(1, Math.round(budget / 10 / 20)),
    addsPerBatch: Math.max(1, Math.round(budget / 20 / 20)),
});

stressDescribe('S1 volume: single store, single collection', () => {
    for (const backend of ALL_BACKENDS) {
        const plan = planFor(backend.volumeBudget);

        stressIt(
            `${backend.name}: survives ${plan.adds.toLocaleString('en-US')} adds then mixed churn without losing a row`,
            {
                seed: 20260802,
                scale: {
                    backend: backend.name,
                    entities: plan.adds,
                    addBatchSize: plan.addBatchSize,
                    mixedBatches: plan.mixedBatches,
                    updatesPerBatch: plan.updatesPerBatch,
                    removesPerBatch: plan.removesPerBatch,
                    addsPerBatch: plan.addsPerBatch,
                },
            },
            async ({ rng, note }) => {
                const store = openStore(backend);
                const oracle = new Oracle<Product>(keyOf);

                let nextValue = 0;
                /** Deterministic content, so a divergence names a specific generated row. */
                const newProduct = () => {
                    const n = nextValue++;
                    return {
                        name: `product-${n}`,
                        category: `category-${n % 25}`,
                        price: n % 1000,
                    };
                };

                // ---- Phase 1: adds -------------------------------------------------
                for (let batch = 0; batch * plan.addBatchSize < plan.adds; batch++) {
                    const size = Math.min(plan.addBatchSize, plan.adds - batch * plan.addBatchSize);

                    const added = await store.products.addAsync(
                        ...Array.from({ length: size }, newProduct) as any[]
                    );
                    const result = await store.saveChangesAsync();

                    expect(result.aggregate.adds).toBe(size);
                    expect(result.aggregate.updates).toBe(0);
                    expect(result.aggregate.removes).toBe(0);

                    // Ids are assigned by the store, so the oracle can only learn them
                    // after the save that generated them.
                    added.forEach(entity => oracle.set(snapshot(entity as Product)));

                    const count = await store.products.countAsync();

                    if (count !== oracle.size) {
                        note(`diverged at add batch ${batch} (${(batch + 1) * plan.addBatchSize} entities in)`);
                    }

                    expect(count).toBe(oracle.size);
                }

                // A collision anywhere in phase 1 shows up as an oracle smaller than the
                // number of entities added — the Map overwrote the earlier row.
                expect(oracle.size).toBe(plan.adds);

                // ---- Phase 2: mixed batches ---------------------------------------
                // One read attaches every entity to the change tracker; mutations then run
                // against those proxies. Re-querying per batch would make the scenario a
                // query benchmark instead of a persistence one, and at this volume it
                // would not finish.
                const tracked = (await store.products.toArrayAsync()) as Product[];

                // Length, never the array itself. A failed `toHaveLength` prints the whole
                // received value, and pretty-formatting a hundred thousand change-tracked
                // proxies takes longer than the scenario it was reporting on — the failure
                // looks like a hang. Every assertion in this file stays scalar for that
                // reason; collection-level divergence goes through `compareToOracle`,
                // which reports a bounded sample.
                expect(tracked.length).toBe(oracle.size);

                const live = new Map(tracked.map(entity => [keyOf(entity), entity]));

                for (let batch = 0; batch < plan.mixedBatches; batch++) {
                    const available = [...live.values()];
                    const targets = rng.sample(available, plan.updatesPerBatch + plan.removesPerBatch);
                    const toUpdate = targets.slice(0, plan.updatesPerBatch);
                    const toRemove = targets.slice(plan.updatesPerBatch);

                    for (const entity of toUpdate) {
                        entity.price = 10_000 + batch;
                        entity.category = `churned-${batch}`;
                    }

                    await store.products.removeAsync(...(toRemove as any[]));

                    const added = await store.products.addAsync(
                        ...Array.from({ length: plan.addsPerBatch }, newProduct) as any[]
                    );

                    const result = await store.saveChangesAsync();

                    // The whole hunt in one place: three kinds of change in one save, each
                    // counted separately, none allowed to absorb another.
                    expect({
                        adds: result.aggregate.adds,
                        updates: result.aggregate.updates,
                        removes: result.aggregate.removes,
                    }).toEqual({
                        adds: plan.addsPerBatch,
                        updates: toUpdate.length,
                        removes: toRemove.length,
                    });

                    toUpdate.forEach(entity => oracle.set(snapshot(entity)));
                    toRemove.forEach(entity => {
                        oracle.delete(keyOf(entity));
                        live.delete(keyOf(entity));
                    });
                    added.forEach(entity => {
                        oracle.set(snapshot(entity as Product));
                        live.set(keyOf(entity as Product), entity as Product);
                    });

                    const count = await store.products.countAsync();

                    if (count !== oracle.size) {
                        note(`diverged at mixed batch ${batch}`);
                    }

                    expect(count).toBe(oracle.size);
                }

                // ---- Final: full read versus the oracle ----------------------------
                const final = (await store.products.toArrayAsync()) as Product[];
                const comparison = compareToOracle(oracle, final, keyOf, {
                    fields: ['name', 'category', 'price'],
                });

                note(describeComparison(comparison));

                expect(describeComparison(comparison)).toBe('oracle matches');
            }
        );
    }
});
