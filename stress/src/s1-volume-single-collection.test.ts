import { afterAll, afterEach } from '@jest/globals';
import { IDbPlugin } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { contractProductSchema } from '@routier/test-utils';
import {
    ALL_BACKENDS,
    Backend,
    Product,
    cleanupBackendArtifacts,
    productFactory,
    productShape,
    runVolumeWorkload,
    stressDescribe,
    stressIt,
    volumePlanFor,
    volumeScale,
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
 *
 * The load itself lives in `harness/workloads.ts` and its entity shape in `harness/shapes.ts`,
 * because S8 runs this same load against real Postgres at a smaller scale. What stays here is
 * the schema, the backend list, and the budget.
 */

class ProductStore extends DataStore {
    products = this.collection(contractProductSchema).create();
}

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

stressDescribe('S1 volume: single store, single collection', () => {
    for (const backend of ALL_BACKENDS) {
        const plan = volumePlanFor(backend.volumeBudget);

        stressIt(
            `${backend.name}: survives ${plan.adds.toLocaleString('en-US')} adds then mixed churn without losing a row`,
            {
                seed: 20260802,
                scale: volumeScale(backend.name, plan),
            },
            async ({ rng, note }) => {
                const store = openStore(backend);

                await runVolumeWorkload<Product>({
                    store,
                    collection: store.products as any,
                    plan,
                    rng,
                    note,
                    newEntity: productFactory(),
                    ...productShape,
                });
            }
        );
    }
});
