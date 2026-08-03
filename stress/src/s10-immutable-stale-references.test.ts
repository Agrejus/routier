import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { shapeCatalog } from '@routier/test-utils';
import {
    Oracle,
    cleanupBackendArtifacts,
    compareToOracle,
    describeComparison,
    memoryBackend,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S10 — the immutable `update()` path under churn, driven entirely through stale
 * references.
 *
 * The spike's unit tests (`ImmutableUpdates.test.ts`) prove a stale reference works once.
 * This asks whether it still works on the ten-thousandth generation, which is a different
 * question: identity resolution has to hold while the pending map fills, drains on every
 * save, and refills, and a single generation that resolves to the wrong base silently
 * loses one write out of ten thousand.
 *
 * The scenario deliberately does the wrong thing on purpose. It captures **one** array of
 * entities at the start and never re-reads it, then writes through those references for
 * the whole run. Under the proxy model that is the correct and only way to work; under
 * immutability every one of those references is stale from the second generation onward.
 * If identity resolution is sound, the run is indistinguishable from one that re-read
 * every cycle — and that equivalence is the property worth pinning, because it is what
 * makes the API safe to hand to callers who will not be careful.
 *
 * Hunts: a patch applied to a stale base (losing whatever changed in between), pending
 * patches surviving a save and replaying (defect #11's shape on the new path), and
 * accumulated-patch drift when a row is updated many times between two saves.
 */

const ENTITIES = 1_000;
const CYCLES = 10_000;
const SUBSET = 50;
const RECONCILE_EVERY = 500;
/** Cycles between saves, so a row accumulates several patches before being flushed. */
const SAVE_EVERY = 3;

const shapeCase = () => {
    const found = shapeCatalog().find(c => c.spec.name === 'multi-scalar' && c.order === 'key-first');

    if (found == null) {
        throw new Error('Shape catalog has no case "multi-scalar [key-first]"');
    }

    return found;
};

class ImmutableStore extends DataStore {
    entities: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).create();
    }
}

type Row = { id: string; text: string; count: number; flag: boolean; at: Date };

const keyOf = (row: Row) => row.id;

const stores: ImmutableStore[] = [];

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S10 immutable updates through stale references', () => {
    stressIt(
        `memory: ${CYCLES.toLocaleString('en-US')} generations written through first-generation references`,
        {
            seed: 20260810,
            scale: {
                backend: memoryBackend.name,
                entities: ENTITIES,
                cycles: CYCLES,
                subsetPerCycle: SUBSET,
                saveEvery: SAVE_EVERY,
            },
        },
        async ({ rng, note }) => {
            const store = new ImmutableStore(memoryBackend.create(), shapeCase().schema);
            stores.push(store);

            await store.entities.addAsync(
                ...Array.from({ length: ENTITIES }, (_, i) => ({
                    id: `imm-${i}`,
                    text: `text-${i}`,
                    count: 0,
                    flag: false,
                    at: new Date(Date.UTC(2020, 0, 1)),
                }))
            );
            await store.saveChangesAsync();

            // Captured ONCE. Never refreshed. Every reference below is stale after the
            // first update touches its row — which is the point.
            const stale = (await store.entities.toArrayAsync()) as Row[];

            expect(stale.length).toBe(ENTITIES);

            // The oracle tracks what each row's value SHOULD be, computed independently of
            // anything the store returns.
            const oracle = new Oracle<Row>(keyOf);
            const expectedCounts = new Map<string, number>();

            stale.forEach(row => {
                expectedCounts.set(row.id, 0);
                oracle.set({ ...row, count: 0 });
            });

            const reconcile = async (cycle: number) => {
                const actual = (await store.entities.toArrayAsync()) as Row[];
                const comparison = compareToOracle(oracle, actual, keyOf, {
                    fields: ['text', 'count', 'flag'],
                });

                if (comparison.matches === false) {
                    note(`first divergence at cycle ${cycle}`);
                    note(describeComparison(comparison));
                }

                expect(comparison.matches ? 'oracle matches' : describeComparison(comparison))
                    .toBe('oracle matches');
            };

            for (let cycle = 0; cycle < CYCLES; cycle++) {
                for (const reference of rng.sample(stale, SUBSET)) {
                    // An updater function, so a wrong base is *observable*: an increment
                    // computed from a stale value produces the wrong number rather than
                    // quietly writing the same thing twice.
                    store.entities.update(reference, (current: Row) => ({
                        ...current,
                        count: current.count + 1,
                        text: `gen-${cycle}`,
                        flag: cycle % 2 === 0,
                    }));

                    const next = (expectedCounts.get(reference.id) ?? 0) + 1;
                    expectedCounts.set(reference.id, next);
                    oracle.set({
                        id: reference.id,
                        text: `gen-${cycle}`,
                        count: next,
                        flag: cycle % 2 === 0,
                        at: reference.at,
                    });
                }

                if (cycle % SAVE_EVERY === 0) {
                    await store.saveChangesAsync();

                    // Nothing may survive a save. This is where defect #11 would show up
                    // on the new path — except there is no per-entity flag to reset, only
                    // a map that is cleared.
                    const stillDirty = await store.hasChangesAsync();

                    if (stillDirty) {
                        note(`store still reported changes after the save in cycle ${cycle}`);
                    }

                    expect(stillDirty).toBe(false);
                }

                if (cycle > 0 && cycle % RECONCILE_EVERY === 0) {
                    await store.saveChangesAsync();
                    await reconcile(cycle);
                }
            }

            await store.saveChangesAsync();
            await reconcile(CYCLES);

            // The strongest single statement the scenario can make: increments applied
            // through a first-generation reference all landed, none were lost to a stale
            // base, and none were double-counted by a replayed patch.
            const total = [...expectedCounts.values()].reduce((sum, n) => sum + n, 0);

            note(`${total.toLocaleString('en-US')} increments applied across ${ENTITIES.toLocaleString('en-US')} rows`);

            expect(total).toBe(CYCLES * SUBSET);

            const actual = (await store.entities.toArrayAsync()) as Row[];
            const observed = actual.reduce((sum, row) => sum + row.count, 0);

            expect(observed).toBe(CYCLES * SUBSET);
        }
    );
});
