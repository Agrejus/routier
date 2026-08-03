import { afterAll, afterEach, expect } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { OptimisticUpdatesDbPlugin } from '@routier/replication-plugin';
import { contractProductSchema } from '@routier/test-utils';
import {
    LaggingPlugin,
    Oracle,
    Product,
    cleanupBackendArtifacts,
    compareToOracle,
    describeComparison,
    productFactory,
    productShape,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S7 — `OptimisticUpdatesDbPlugin` under lag.
 *
 * The plugin's whole promise is that a caller never waits for the slow database: a save lands
 * in an in-process read plugin, acknowledges from there, and is mirrored to the real source
 * afterwards. Every defect this hunts lives in the window that opens between those two
 * moments — and against the plugins in this repository that window is closed, because they
 * are all in-process or on local disk and the mirror write has already landed by the next
 * statement. So the source here is wrapped in a `LaggingPlugin` (harness/lagging-plugin.ts),
 * which holds each mirror callback 10–50ms and makes the window wide enough to write tests
 * against.
 *
 * What can go wrong inside it:
 *
 *  - **Re-hydration resurrection.** This was defect #10, and the fix is the
 *    `writtenCollections` set: once this instance has persisted to a collection, the read
 *    plugin is authoritative for it, so an empty read is real data rather than a missed
 *    hydration. Without that, removing every row makes the read plugin look unhydrated, and
 *    the next query re-hydrates from a source whose removals are still in flight — bringing
 *    every removed entity back. Phase 3 below is that exact sequence, which is the only shape
 *    that can trip it: any smaller removal leaves the read plugin non-empty and the hydration
 *    branch untaken.
 *  - **Mirror ordering.** 2,000 saves each schedule a mirror write on an independent timer, so
 *    they complete out of the order they were issued. If the mirror payload is a whole-value
 *    write rather than the resolved change, a late arrival overwrites a newer one and the
 *    source ends the run disagreeing with the read plugin.
 *  - **Read-your-writes.** The acknowledgement is the contract. A query issued after a save
 *    returns must reflect it, no matter what the mirror is still doing.
 *
 * The source is read through its own `DataStore` over the same `MemoryPlugin` instance, rather
 * than by reaching into the replicator's protected `plugins`. Same evidence, no private
 * access, and it fails for the right reason if the internals are rearranged.
 */

const SAVES = 2_000;
/** Entities touched per save, of each kind. */
const ADDS_PER_SAVE = 2;
const UPDATES_PER_SAVE = 2;
/** Saves between removals; every one of these also removes an entity. */
const REMOVE_EVERY = 5;
/** Removed ids re-checked for absence on each save. */
const ABSENCE_SAMPLE = 5;
const LAG_MIN_MS = 10;
const LAG_MAX_MS = 50;
/**
 * Saves between yields to the timer queue.
 *
 * See the call site: without a yield the mirror never advances at all. Yielding on every save
 * would be the other extreme — the mirror would keep pace and there would be no backlog to
 * race against — so this is set to leave a standing backlog while still letting late writes
 * land among live ones.
 */
const YIELD_EVERY = 10;

class ProductStore extends DataStore {
    products = this.collection(contractProductSchema).proxy().create();
}

const { keyOf, snapshot, fields } = productShape;

const stores: DataStore[] = [];
const laggedPlugins: LaggingPlugin[] = [];

/**
 * This scenario used to stub `console.log/info/debug` for its own duration.
 *
 * `OptimisticUpdatesDbPlugin` logs three debug lines per query, and the logger auto-enabled
 * itself whenever `NODE_ENV` was `test` — which Jest always sets. At 2,000 saves that was tens of
 * thousands of console records for Jest to capture, each with a stack-trace snapshot: 12.4s with
 * the logging against ~6s without, and a seed-and-scale banner buried under the output.
 *
 * The logger now defaults to `silent` and `NODE_ENV=test` no longer enables it, so the stub is
 * gone. To see the plugin's own logging while working on this scenario:
 *
 *     ROUTIER_LOG_LEVEL=debug STRESS=1 npx jest --selectProjects stress -t 'S7'
 */

afterEach(async () => {
    // Cancel first. A pending mirror callback is a live timer, and letting it fire after the
    // store it targets has been destroyed turns a clean teardown into an unhandled rejection
    // in whichever scenario runs next.
    for (const plugin of laggedPlugins.splice(0)) {
        plugin.cancel();
    }
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S7 replication: OptimisticUpdatesDbPlugin under lag', () => {
    stressIt(
        `memory: ${SAVES.toLocaleString('en-US')} saves against a source lagging ${LAG_MIN_MS}-${LAG_MAX_MS}ms stay read-your-writes`,
        {
            seed: 20260808,
            scale: {
                backend: 'memory (lagged source)',
                saves: SAVES,
                addsPerSave: ADDS_PER_SAVE,
                updatesPerSave: UPDATES_PER_SAVE,
                removeEvery: REMOVE_EVERY,
                lagMinMs: LAG_MIN_MS,
                lagMaxMs: LAG_MAX_MS,
            },
        },
        async ({ rng, note }) => {
            const source = new MemoryPlugin(`stress-optimistic-source-${uuidv4()}`);
            const lagged = new LaggingPlugin(source, rng, { minMs: LAG_MIN_MS, maxMs: LAG_MAX_MS });
            laggedPlugins.push(lagged);

            const store = new ProductStore(new OptimisticUpdatesDbPlugin(lagged));
            stores.push(store);

            const oracle = new Oracle<Product>(keyOf);
            /** Ids this run has removed. Nothing may ever bring one of them back. */
            const removed: string[] = [];
            const live = new Map<string, Product>();

            const newProduct = productFactory();

            /** The widest mirror backlog seen while a query was answered. */
            let maxInFlight = 0;
            let queriesWithMirrorsInFlight = 0;
            /** Mirror callbacks that had landed by the time phase 1 ended. */
            let completedDuringRun = 0;

            // ---- Phase 1: interleaved saves and queries -----------------------
            for (let save = 0; save < SAVES; save++) {
                const added = (await store.products.addAsync(
                    ...Array.from({ length: ADDS_PER_SAVE }, newProduct) as any[]
                )) as Product[];

                const updatable = [...live.values()];
                const toUpdate = rng.sample(updatable, Math.min(UPDATES_PER_SAVE, updatable.length));

                for (const product of toUpdate) {
                    product.price = 10_000 + save;
                    product.category = `churned-${save}`;
                }

                const toRemove = save % REMOVE_EVERY === 0 && updatable.length > 0
                    ? rng.sample(updatable.filter(p => toUpdate.includes(p) === false), 1)
                    : [];

                await store.products.removeAsync(...(toRemove as any[]));

                await store.saveChangesAsync();

                added.forEach(product => {
                    oracle.set(snapshot(product));
                    live.set(keyOf(product), product);
                });
                toUpdate.forEach(product => oracle.set(snapshot(product)));
                toRemove.forEach(product => {
                    oracle.delete(keyOf(product));
                    live.delete(keyOf(product));
                    removed.push(keyOf(product));
                });

                // Read-your-writes, checked with no wait of any kind. The mirror is still
                // behind; the acknowledgement says the data is readable, so it must be.
                const inFlight = lagged.inFlight;
                maxInFlight = Math.max(maxInFlight, inFlight);

                if (inFlight > 0) {
                    queriesWithMirrorsInFlight++;
                }

                const count = await store.products.countAsync();

                if (count !== oracle.size) {
                    note(`read-your-writes failed at save ${save}: counted ${count}, oracle holds ${oracle.size}, ${inFlight} mirror write(s) in flight`);
                }

                expect(count).toBe(oracle.size);

                // A sample of the removals, re-checked while their mirror deletes may still
                // be in flight. Checking every removed id every save would make the scenario
                // quadratic and is unnecessary: a resurrection persists, so a rotating sample
                // finds it within a few saves.
                // Let the mirror make progress. Without this the scenario tests a mirror that
                // is stopped rather than one that is behind: `await` over an in-process plugin
                // resolves through microtasks, never reaching the timer queue, so every mirror
                // callback would stay pending until phase 1 ended. Measured, that is exactly
                // what happened — a backlog of 2,000 out of 2,000 — and it left the
                // mirror-ordering hunt untested, because no late write ever raced a new one.
                if (save % YIELD_EVERY === 0) {
                    await lagged.yieldToTimers();
                }

                for (const id of rng.sample(removed, ABSENCE_SAMPLE)) {
                    const found = await store.products.where(([p, params]) => p._id === params.id, { id }).countAsync();

                    if (found !== 0) {
                        note(`removed entity ${id} was readable again at save ${save}`);
                    }

                    expect(found).toBe(0);
                }
            }

            completedDuringRun = lagged.stats.completedCallbacks;

            note(
                `${queriesWithMirrorsInFlight} of ${SAVES} queries ran with mirror writes in flight ` +
                `(widest backlog ${maxInFlight}); ${lagged.stats.delayedCallbacks} mirror callbacks delayed ` +
                `${Math.round(lagged.stats.totalDelayMs / 1000)}s in total, ${completedDuringRun} landed during the run`
            );

            // The scenario is only evidence if the window it needs was actually open, and
            // "open" needs both halves:
            //
            //  - queries answered while the mirror was behind, or nothing was read mid-flight;
            //  - mirror writes that LANDED mid-run, or no late write ever raced a live one and
            //    the ordering hunt is vacuous however green it looks.
            expect(queriesWithMirrorsInFlight).toBeGreaterThan(0);
            expect(completedDuringRun).toBeGreaterThan(0);
            expect(removed.length).toBeGreaterThan(0);

            // ---- Phase 2: source converges once the lag drains ---------------
            await lagged.drain(120_000);

            const sourceStore = new ProductStore(source);
            stores.push(sourceStore);

            const inSource = (await sourceStore.products.toArrayAsync()) as Product[];
            const sourceComparison = compareToOracle(oracle, inSource, keyOf, {
                fields,
            });

            if (sourceComparison.matches === false) {
                note(`source after drain: ${describeComparison(sourceComparison)}`);
            }

            // Mirror ordering, stated as data. Out-of-order mirror writes show up here as
            // stale field values rather than as missing rows, which is why the fields are
            // compared and not only the membership.
            expect(sourceComparison.matches ? 'source matches oracle' : describeComparison(sourceComparison))
                .toBe('source matches oracle');

            const inRead = (await store.products.toArrayAsync()) as Product[];
            const readComparison = compareToOracle(oracle, inRead, keyOf, {
                fields,
            });

            expect(readComparison.matches ? 'read plugin matches oracle' : describeComparison(readComparison))
                .toBe('read plugin matches oracle');

            // ---- Phase 3: remove everything, then read -----------------------
            // The resurrection shape, and the only one that reaches the hydration branch: it
            // is guarded on the read plugin's collection being EMPTY, so nothing short of
            // removing every row can take it. With the mirror deletes still in flight, an
            // unguarded hydration would read the source, find the rows it has not yet deleted,
            // and put every one of them back.
            const everything = (await store.products.toArrayAsync()) as Product[];

            expect(everything.length).toBe(oracle.size);

            await store.products.removeAsync(...(everything as any[]));
            await store.saveChangesAsync();

            const backlogAtEmpty = lagged.inFlight;

            note(`removed all ${everything.length} entities with ${backlogAtEmpty} mirror write(s) still in flight`);

            const afterRemoveAll = await store.products.countAsync();

            if (afterRemoveAll !== 0) {
                note(`${afterRemoveAll} entities were readable after removing every row — re-hydration resurrection (defect #10)`);
            }

            expect(afterRemoveAll).toBe(0);

            // Read again after the mirror finishes. The first read could pass simply because
            // the source had not been consulted yet; this one is after every delete landed.
            await lagged.drain(120_000);

            expect(await store.products.countAsync()).toBe(0);
            expect(await sourceStore.products.countAsync()).toBe(0);
        }
    );
});
