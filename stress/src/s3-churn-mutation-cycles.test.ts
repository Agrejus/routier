import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { shapeCatalog } from '@routier/test-utils';
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
 */

const CYCLES = 10_000;
const ENTITIES = 1_000;
const SUBSET = 50;
/** Cycles between full oracle reconciliations. */
const RECONCILE_EVERY = 500;
/** Cycles between RSS samples. 40 samples over the run gives the regression something to fit. */
const SAMPLE_EVERY = 250;
/**
 * Cycles between full `previewChangesAsync` calls.
 *
 * The spec asks for one after every save. `previewChanges` runs the entire prepare
 * pipeline over all 1,000 attachments, so ten thousand of them would dominate the
 * scenario's runtime and push it past the 5-minute per-file budget. Instead the cheap
 * form of the same invariant — `hasChangesAsync`, which short-circuits on the first dirty
 * entity — runs after EVERY save, and the full preview runs periodically to confirm the
 * cheap check is not lying. A tracker that fails to clean up fails the cheap check on
 * cycle 2, so nothing is lost by sampling the expensive one.
 */
const PREVIEW_EVERY = 25;

/**
 * `multi-mixed-modifiers` — a scalar, a depth-1 nested object, and an array in one shape,
 * plus nullable/optional/default/renamed modifiers along for the ride.
 *
 * It is also the one catalog shape S2 can drive end to end: `object-depth-3` trips defect
 * #13 and `array-of-date` trips #12. Both of those are pinned in S2, and re-tripping them
 * here would only re-report a known gap while destroying this scenario's ability to find
 * anything else.
 */
const shapeCase = () => {
    const found = shapeCatalog().find(c => c.spec.name === 'multi-mixed-modifiers' && c.order === 'key-first');

    if (found == null) {
        throw new Error('Shape catalog has no case "multi-mixed-modifiers [key-first]"');
    }

    return found;
};

class ChurnStore extends DataStore {
    entities: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).create();
    }
}

type Churned = {
    id: string;
    text: string | null;
    count?: number;
    nested: { value: string };
    values: string[];
};

const keyOf = (entity: Churned) => entity.id;

const snapshot = (entity: Churned): Churned => ({
    id: entity.id,
    text: entity.text,
    count: entity.count,
    nested: { value: entity.nested.value },
    values: [...entity.values],
});

const stores: ChurnStore[] = [];

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S3 churn: long-running mutation cycles', () => {
    stressIt(
        `memory: ${CYCLES.toLocaleString('en-US')} cycles over ${ENTITIES.toLocaleString('en-US')} entities leave no residue`,
        {
            seed: 20260803,
            scale: {
                backend: memoryBackend.name,
                entities: ENTITIES,
                cycles: CYCLES,
                subsetPerCycle: SUBSET,
                reconcileEvery: RECONCILE_EVERY,
                rssSampleEvery: SAMPLE_EVERY,
            },
        },
        async ({ rng, note }) => {
            const store = new ChurnStore(memoryBackend.create(), shapeCase().schema);
            stores.push(store);

            const oracle = new Oracle<Churned>(keyOf);
            const trace = new MemoryTrace();

            let generation = 0;

            const seed = Array.from({ length: ENTITIES }, (_, i) => ({
                id: `churn-${i}`,
                text: `text-${i}`,
                count: i,
                at: new Date(Date.UTC(2020, 0, 1 + (i % 28))),
                nested: { value: `n${i}` },
                values: [`a${i}`, `b${i}`],
            }));

            await store.entities.addAsync(...seed);
            await store.saveChangesAsync();

            (await store.entities.toArrayAsync()).forEach((entity: Churned) => oracle.set(snapshot(entity)));

            expect(oracle.size).toBe(ENTITIES);

            /** Reconciles the database against the oracle, failing with a bounded report. */
            const reconcile = async (cycle: number) => {
                const actual = (await store.entities.toArrayAsync()) as Churned[];
                const comparison = compareToOracle(oracle, actual, keyOf, {
                    fields: ['text', 'count', 'nested', 'values'],
                });

                if (comparison.matches === false) {
                    note(`first divergence observed at cycle ${cycle}`);
                    note(describeComparison(comparison));
                }

                expect(comparison.matches ? 'oracle matches' : describeComparison(comparison))
                    .toBe('oracle matches');
            };

            for (let cycle = 0; cycle < CYCLES; cycle++) {
                // Re-querying every cycle rather than holding one array is deliberate: the
                // read path re-resolves attachments, and a tracker that grows an entry per
                // resolve instead of reusing the canonical one only shows up under repeated
                // reads.
                const page = (await store.entities.toArrayAsync()) as Churned[];
                const targets = rng.sample(page, SUBSET);

                generation++;

                for (const entity of targets) {
                    entity.text = `text-gen${generation}`;
                    entity.nested.value = `nested-gen${generation}`;
                    // Whole-array replacement, not `values[0] = ...`. In-place element
                    // writes stop being tracked after the entity's first merge (defect
                    // #12, pinned in S2); using them here would silently drop the edit and
                    // report this scenario's oracle mismatch as if it were a new finding.
                    entity.values = [`gen${generation}`, `b-${entity.id}`];
                }

                // Occasional remove-and-re-add, so the attachment map sees entities leave
                // and come back rather than only being mutated in place.
                const recycled = rng.chance(0.05) ? rng.sample(targets, 1)[0] : null;

                if (recycled != null) {
                    await store.entities.removeAsync(recycled);
                }

                await store.saveChangesAsync();

                targets.forEach(entity => oracle.set(snapshot(entity)));

                if (recycled != null) {
                    oracle.delete(keyOf(recycled));

                    const replacement = {
                        id: recycled.id,
                        text: `text-readd${generation}`,
                        count: generation,
                        at: new Date(Date.UTC(2021, 0, 1 + (generation % 28))),
                        nested: { value: `nested-readd${generation}` },
                        values: [`readd${generation}`],
                    };

                    const [readded] = await store.entities.addAsync(replacement);
                    await store.saveChangesAsync();
                    oracle.set(snapshot(readded as Churned));
                }

                // The cheap form of "no pending changes after a save", run every cycle.
                const stillDirty = await store.hasChangesAsync();

                if (stillDirty) {
                    note(`store still reported changes immediately after the save in cycle ${cycle}`);
                }

                expect(stillDirty).toBe(false);

                if (cycle % PREVIEW_EVERY === 0) {
                    const pending = await store.previewChangesAsync();

                    if (pending.aggregate.size !== 0) {
                        note(
                            `cycle ${cycle}: previewChanges reported ${pending.aggregate.size} pending ` +
                            `(adds ${pending.aggregate.adds}, updates ${pending.aggregate.updates}, removes ${pending.aggregate.removes})`
                        );
                    }

                    expect(pending.aggregate.size).toBe(0);
                }

                if (cycle % SAMPLE_EVERY === 0) {
                    trace.sample(cycle);
                }

                if (cycle > 0 && cycle % RECONCILE_EVERY === 0) {
                    await reconcile(cycle);
                }
            }

            trace.sample(CYCLES);
            await reconcile(CYCLES);

            const verdict = trace.verdict();

            note(verdict.report);

            expect(verdict.leaking ? verdict.report : 'growth decays').toBe('growth decays');
        }
    );
});
