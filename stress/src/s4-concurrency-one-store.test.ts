import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { shapeCatalog } from '@routier/test-utils';
import {
    Oracle,
    Rng,
    cleanupBackendArtifacts,
    compareToOracle,
    describeComparison,
    memoryBackend,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S4 — parallel saves against a single store.
 *
 * Everything up to here is sequential: one await at a time, one save in flight. Real
 * callers are not. Twenty independent code paths writing through one store, none of them
 * awaiting the others, is the ordinary shape of a UI or a request handler, and it is the
 * shape none of the functional suite exercises.
 *
 * What that arrangement can break:
 *
 *  - **Pipeline reentrancy.** `TrampolinePipeline`/`WorkPipeline` carry per-run state.
 *    A second `saveChanges` entering while the first is mid-flight shares whatever is not
 *    stack-local.
 *  - **Shared query options.** `SelectionQueryable` snapshots and restores
 *    `request.queryOptions` around each execution. That snapshot/restore is recent, and
 *    it is precisely the pattern that breaks under interleaving: if two queries overlap,
 *    the second's restore can undo the first's setup.
 *  - **Tag collection cross-talk.** Tags are held per collection, not per save. Twenty
 *    concurrent tagged saves are the case where one worker's tags can leave with
 *    another's changes.
 *
 * A note on what is NOT asserted. `saveChangesAsync` is store-wide: it flushes every
 * pending change in the store, not just the caller's. So a worker's save legitimately
 * persists other workers' pending mutations, and its reported aggregate legitimately
 * counts them. Asserting per-worker isolation would be asserting a guarantee the API does
 * not make. What must hold is that the *union* is exact — nothing lost, nothing
 * duplicated, and no worker's values corrupted by another's.
 */

const WORKERS = 20;
const SAVES_PER_WORKER = 200;
const ENTITIES_PER_WORKER = 10;

const shapeCase = () => {
    const found = shapeCatalog().find(c => c.spec.name === 'multi-scalar' && c.order === 'key-first');

    if (found == null) {
        throw new Error('Shape catalog has no case "multi-scalar [key-first]"');
    }

    return found;
};

class ConcurrentStore extends DataStore {
    entities: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).proxy().create();
    }
}

type Row = { id: string; text: string; count: number; flag: boolean; at: Date };

const keyOf = (row: Row) => row.id;

const snapshot = (row: Row): Row => ({
    id: row.id,
    text: row.text,
    count: row.count,
    flag: row.flag,
    at: row.at,
});

const stores: ConcurrentStore[] = [];

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S4 concurrency: parallel saves in one store', () => {
    stressIt(
        `memory: ${WORKERS} workers x ${SAVES_PER_WORKER} saves converge on the union of their writes`,
        {
            seed: 20260804,
            scale: {
                backend: memoryBackend.name,
                workers: WORKERS,
                savesPerWorker: SAVES_PER_WORKER,
                entitiesPerWorker: ENTITIES_PER_WORKER,
                totalSaves: WORKERS * SAVES_PER_WORKER,
            },
        },
        async ({ note }) => {
            const store = new ConcurrentStore(memoryBackend.create(), shapeCase().schema);
            stores.push(store);

            // Each worker owns a disjoint key range and writes only inside it. That is what
            // makes the final state predictable despite the interleaving: an entity's last
            // value is whatever its owner wrote last, regardless of whose save flushed it.
            const keyFor = (worker: number, index: number) => `w${String(worker).padStart(2, '0')}-${index}`;

            const seeded = Array.from({ length: WORKERS }, (_, worker) =>
                Array.from({ length: ENTITIES_PER_WORKER }, (_, index) => ({
                    id: keyFor(worker, index),
                    text: `seed-${worker}-${index}`,
                    count: 0,
                    flag: false,
                    at: new Date(Date.UTC(2020, 0, 1)),
                }))
            ).flat();

            await store.entities.addAsync(...seeded);
            await store.saveChangesAsync();

            const failures: string[] = [];
            const oracles = Array.from({ length: WORKERS }, () => new Oracle<Row>(keyOf));

            /**
             * One worker's whole life. Started but not awaited individually — the point is
             * that all twenty are in flight at once.
             */
            const runWorker = async (worker: number) => {
                // A per-worker seed keeps each worker deterministic on its own, which is
                // what makes a failure reducible: the interleaving varies between runs,
                // the decisions inside a worker do not.
                const rng = new Rng(20260804 + worker * 7919);
                const oracle = oracles[worker];
                const owned = new Set(
                    Array.from({ length: ENTITIES_PER_WORKER }, (_, i) => keyFor(worker, i))
                );

                let added = 0;

                for (let save = 0; save < SAVES_PER_WORKER; save++) {
                    const mine = ((await store.entities.toArrayAsync()) as Row[])
                        .filter(row => owned.has(row.id));

                    if (mine.length !== owned.size) {
                        failures.push(
                            `worker ${worker} save ${save}: expected ${owned.size} of its own rows, saw ${mine.length}`
                        );
                        return;
                    }

                    for (const row of rng.sample(mine, Math.max(1, rng.int(mine.length) + 1))) {
                        row.text = `w${worker}-s${save}`;
                        row.count = save;
                        row.flag = save % 2 === 0;
                    }

                    if (rng.chance(0.1)) {
                        const id = keyFor(worker, ENTITIES_PER_WORKER + added++);
                        owned.add(id);
                        await store.entities.addAsync({
                            id,
                            text: `w${worker}-added-s${save}`,
                            count: save,
                            flag: true,
                            at: new Date(Date.UTC(2021, 0, 1)),
                        });
                    }

                    try {
                        await store.saveChangesAsync();
                    } catch (error: any) {
                        // A rejected save under concurrency is a finding in itself, and it
                        // is recorded rather than thrown so the other workers finish and
                        // the final state can still be inspected.
                        failures.push(`worker ${worker} save ${save} rejected: ${error?.message ?? String(error)}`);
                        return;
                    }
                }

                // Read the worker's own rows once at the end. Its last write wins, because
                // no other worker touches its key range.
                ((await store.entities.toArrayAsync()) as Row[])
                    .filter(row => owned.has(row.id))
                    .forEach(row => oracle.set(snapshot(row)));
            };

            // Started together, awaited together. No worker awaits another.
            await Promise.all(Array.from({ length: WORKERS }, (_, worker) => runWorker(worker)));

            if (failures.length > 0) {
                failures.slice(0, 10).forEach(failure => note(failure));
                note(`${failures.length} failure(s) total`);
            }

            expect(failures.length === 0 ? 'no worker failed' : failures[0]).toBe('no worker failed');

            const union = new Oracle<Row>(keyOf);
            oracles.forEach(oracle => union.merge(oracle));

            const actual = (await store.entities.toArrayAsync()) as Row[];
            const comparison = compareToOracle(union, actual, keyOf, {
                fields: ['text', 'count', 'flag'],
            });

            note(`union oracle holds ${union.size} rows; database returned ${actual.length}`);

            expect(comparison.matches ? 'oracle matches' : describeComparison(comparison))
                .toBe('oracle matches');

            // Cross-worker corruption has a signature the union check can miss when two
            // workers happen to agree: every row's text must name the worker that owns its
            // key range.
            const misowned = actual.find(row => row.text.startsWith(`w${Number(row.id.slice(1, 3))}-`) === false);

            expect(misowned == null ? 'every row carries its owner' : `${misowned.id} carries "${misowned.text}"`)
                .toBe('every row carries its owner');

            // The store must be quiet once every worker has finished.
            expect(await store.hasChangesAsync()).toBe(false);
        }
    );
});
