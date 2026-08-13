import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { DataStore } from '@routier/datastore';
import {
    ChurnPlan,
    Churned,
    churnScale,
    churnShape,
    churnShapeCase,
    cleanupBackendArtifacts,
    memoryBackend,
    runChurnWorkload,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S3 — long-running mutation cycles.
 *
 * S1 and S2 push volume through in a straight line. This one goes in circles: a small
 * entity set, churned ten thousand times. The distinction matters because the two hunt
 * different things. Volume finds what breaks when a structure gets big; churn finds what
 * never gets released — state that accumulates a little on every cycle and is invisible
 * until the ten-thousandth.
 *
 * Defect #11 (specs/known-defects.md) is exactly that class and was found here in
 * embryo: entities never went clean after a save, so every cycle added another
 * permanently-dirty entity to the set re-sent on the next one. The work per save grew with
 * the number of cycles already run. This scenario is what keeps that fixed.
 *
 * Three invariants, each aimed at a different way the tracker can rot:
 *
 *  - **Oracle equality every 500 cycles.** Catches drift that accumulates too slowly to
 *    show in a single cycle.
 *  - **Zero pending changes after every save.** The direct statement of defect #11. A
 *    tracker that keeps entities dirty fails here on the second cycle, not the ten
 *    thousandth, which is what makes it worth asserting every time.
 *  - **RSS growth must decay.** An absolute ceiling would be the wrong check — see
 *    harness/memory.ts. What a leak looks like is a growth *rate* that never flattens.
 *
 * The load lives in `harness/workloads.ts` and its entity shape in `harness/shapes.ts`,
 * because S8 runs the same load against real Postgres at 2k cycles. What stays here is the
 * plan and the memory invariant.
 */

const plan: ChurnPlan = {
    entities: 1_000,
    cycles: 10_000,
    subset: 50,
    reconcileEvery: 500,
    /** 40 samples over the run gives the growth regression something to fit. */
    sampleEvery: 250,
    previewEvery: 25,
    trackMemory: true,
};

class ChurnStore extends DataStore {
    entities: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).proxy().create();
    }
}

const stores: ChurnStore[] = [];

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S3 churn: long-running mutation cycles', () => {
    stressIt(
        `memory: ${plan.cycles.toLocaleString('en-US')} cycles over ${plan.entities.toLocaleString('en-US')} entities leave no residue`,
        {
            seed: 20260803,
            scale: churnScale(memoryBackend.name, plan),
        },
        async ({ rng, note }) => {
            const store = new ChurnStore(memoryBackend.create(), churnShapeCase().schema);
            stores.push(store);

            await runChurnWorkload<Churned>({
                store,
                collection: store.entities,
                plan,
                rng,
                note,
                ...churnShape,
            });

            // The workload's own final reconciliation covers the data; this is the one thing
            // it cannot assert generically, because "no residue" is about this process.
            expect(await store.hasChangesAsync()).toBe(false);
        }
    );
});
