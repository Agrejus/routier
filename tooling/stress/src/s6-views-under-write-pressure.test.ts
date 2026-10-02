import { afterAll, afterEach, expect } from '@jest/globals';
import { MemoryPlugin } from '@routier/memory-plugin';
import { TestDataStore } from '@routier/memory-plugin/tests/datastore/MemoryDatastore';
import { uuidv4 } from '@routier/core';
import {
    cleanupBackendArtifacts,
    pollUntil,
    pollUntilStable,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S6 — views and subscriptions under write pressure.
 *
 * Every scenario before this one wrote to a collection and read the same collection back.
 * A view is the case where a write to one collection causes a write to another, without the
 * caller asking: `View`'s constructor subscribes to its source collection and, on every
 * notification, recomputes the derived rows, diffs them against what is stored, and persists
 * the difference itself. That inversion is where the interesting failures live.
 *
 *  - **Feedback loops.** A view that notifies its own source re-derives forever. Nothing in
 *    the type system prevents it; the only evidence is a run that does not terminate, which
 *    is why the convergence checks here have deadlines rather than being awaited.
 *  - **Notification amplification.** One save should cost one derive and at most one
 *    notification per subscriber. If a derive's own persist re-enters the subscription that
 *    triggered it, the count per save grows with the number of saves already made and the
 *    scenario is quadratic before it is wrong.
 *  - **The empty-send guard.** `View` skips both the persist and the `subscription.send`
 *    when a derive produces no change (View.ts, "Nothing to persist"). The guard is what
 *    makes a re-derive over unchanged data free. Losing it would not fail a functional test
 *    — the data stays correct — it would only show up as notifications that never stop.
 *  - **Compute-once identity.** `productsHistory` keys rows on `fastHash` of their own
 *    content, so a content change mints a new row and unchanged content maps back onto the
 *    existing one. That is what makes "history only grows, and by exactly N" checkable; it
 *    also means an identity that is not stable across derives grows the history without
 *    bound on every write.
 *
 * **A view derive is O(all rows), not O(the change.)** Measured here, and the reason this
 * file's poll deadlines are minutes rather than seconds: `derive` is handed the source
 * collection's entire result set on every notification, re-enriches all of it, re-queries the
 * view by every id, and hashes each row to diff it. So the cost of one 50-entity save grows
 * with the collection it lands in. Convergence after 100 batches of 50, on the memory plugin:
 *
 * |  products | writes | convergence |
 * | --------- | ------ | ----------- |
 * |       500 |   14ms |       270ms |
 * |     2,000 |   83ms |        5.3s |
 * |     5,000 |  213ms |         61s |
 *
 * Writes stay linear and cheap; convergence is roughly quadratic. That is a property of the
 * full-recompute design rather than a defect, but it sets the ceiling on how large a view can
 * be while its source is under sustained write pressure, and it is why 5,000 is the scale
 * here — the next power up does not fit the 5-minute per-file budget.
 *
 * **Views are frozen.** `View.changeTrackingType` returns `"immutable"` (View.ts:161), so
 * since defect #17 was fixed a view read hands back frozen objects. That is asserted here
 * directly rather than assumed: it is the one property of this scenario that changed
 * underneath the spec, and a view that silently stopped freezing would let a caller mutate
 * derived state that nothing will ever persist.
 */

/** Product saves, in batches. The spec's shape: 5k saves in batches of 50. */
const PRODUCTS = 5_000;
const BATCH_SIZE = 50;
const BATCHES = PRODUCTS / BATCH_SIZE;
/** Products whose content is changed in the history-growth phase. */
const UPDATES = 100;

type Product = {
    _id: string;
    name: string;
    price: number;
    category: string;
    inStock: boolean;
    tags: string[];
    createdDate: Date;
};

const stores: TestDataStore[] = [];
const unsubscribes: (() => void)[] = [];

const openStore = () => {
    // A uuid database name: MemoryPlugin's `dbs` registry is process-global, so a fixed name
    // would share rows with every other scenario in the worker.
    const store = new TestDataStore(new MemoryPlugin(`stress-views-${uuidv4()}`));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const unsubscribe of unsubscribes.splice(0)) {
        try { unsubscribe(); } catch { /* already torn down */ }
    }
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
        store[Symbol.dispose]();
    }
});

afterAll(cleanupBackendArtifacts);

/** Deterministic product content, so a divergence names a specific generated row. */
const newProduct = (n: number) => ({
    name: `product-${n}`,
    price: n % 1000,
    category: `category-${n % 25}`,
    inStock: n % 2 === 0,
    tags: n % 3 === 0 ? ['computer'] : ['accessory'],
    createdDate: new Date(Date.UTC(2020, 0, 1 + (n % 28))),
});

stressDescribe('S6 views and subscriptions under write pressure', () => {
    stressIt(
        `memory: ${PRODUCTS.toLocaleString('en-US')} product saves in ${BATCHES} batches converge the views without over-notifying`,
        {
            seed: 20260807,
            scale: {
                backend: 'memory',
                products: PRODUCTS,
                batchSize: BATCH_SIZE,
                batches: BATCHES,
                contentChangingUpdates: UPDATES,
            },
        },
        async ({ note }) => {
            const store = openStore();

            // Subscribers first. A message sent before a subscriber exists is dropped by the
            // timestamp guard, so subscribing after the writes would measure nothing.
            const viewObserved = { notifications: 0, lastCount: -1 };
            const historyObserved = { notifications: 0, lastCount: -1 };

            const watch = (view: any, observed: { notifications: number; lastCount: number }) => {
                const unsubscribe = view.subscribe().toArray((response: any) => {
                    observed.notifications++;

                    if (response.ok !== 'error') {
                        observed.lastCount = response.data.length;
                    }
                });

                if (typeof unsubscribe === 'function') {
                    unsubscribes.push(unsubscribe);
                }
            };

            watch(store.productsView, viewObserved);
            watch(store.productsHistory, historyObserved);

            // ---- Phase 1: write pressure --------------------------------------
            // Nothing here waits for a view to catch up. That is the pressure: each batch
            // lands while the previous batch's derive may still be in flight.
            let historyHighWater = 0;

            for (let batch = 0; batch < BATCHES; batch++) {
                await store.products.addAsync(
                    ...Array.from({ length: BATCH_SIZE }, (_, i) => newProduct(batch * BATCH_SIZE + i)) as any[]
                );
                await store.saveChangesAsync();

                // History rows are only ever added, never updated or removed — a content
                // change mints a new row. A count that ever drops means a derive replaced
                // rows it should have left alone.
                const historyCount = await store.productsHistory.countAsync();

                if (historyCount < historyHighWater) {
                    note(`productsHistory dropped from ${historyHighWater} to ${historyCount} at batch ${batch}`);
                }

                expect(historyCount >= historyHighWater
                    ? 'history only grew'
                    : `history dropped from ${historyHighWater} to ${historyCount} at batch ${batch}`)
                    .toBe('history only grew');

                historyHighWater = Math.max(historyHighWater, historyCount);
            }

            expect(await store.products.countAsync()).toBe(PRODUCTS);

            // ---- Phase 2: convergence ----------------------------------------
            const viewCount = await pollUntil(
                () => store.productsView.countAsync(),
                count => count === PRODUCTS,
                {
                    describe: `productsView count reaches ${PRODUCTS}`,
                    deadlineMs: 240_000,
                    intervalMs: 50,
                    render: count => String(count),
                }
            ).catch((error: Error) => {
                note(error.message);
                throw error;
            });

            expect(viewCount).toBe(PRODUCTS);

            // History has no predictable target mid-flight, only one it settles on, so it is
            // polled for stability rather than for a number.
            const settledHistory = await pollUntilStable(
                () => store.productsHistory.countAsync(),
                {
                    describe: 'productsHistory count settles',
                    deadlineMs: 240_000,
                    intervalMs: 50,
                    stableSamples: 5,
                    render: count => String(count),
                }
            );

            note(`productsHistory settled at ${settledHistory} rows for ${PRODUCTS} products`);

            // One history row per product: every product was added once and never changed,
            // so no product should have contributed two content hashes.
            expect(settledHistory).toBe(PRODUCTS);

            // ---- Phase 3: views are frozen ------------------------------------
            const [sampleView] = await store.productsView.take(1).toArrayAsync();
            const [sampleHistory] = await store.productsHistory.take(1).toArrayAsync();

            expect(Object.isFrozen(sampleView)).toBe(true);
            expect(Object.isFrozen(sampleHistory)).toBe(true);

            // Frozen, not merely flagged. Under a module's strict mode the write throws;
            // a view that stopped freezing would let this silently succeed and the caller
            // would be editing state nothing will persist.
            expect(() => { (sampleView as any).name = 'mutated'; }).toThrow();

            // ---- Phase 4: history grows by exactly N -------------------------
            const beforeUpdates = settledHistory;
            const targets = (await store.products.take(UPDATES).toArrayAsync()) as Product[];

            expect(targets.length).toBe(UPDATES);

            for (const product of targets) {
                // A content change, so each target must mint exactly one new history row.
                product.price = product.price + 100_000;
            }

            await store.saveChangesAsync();

            const afterUpdates = await pollUntilStable(
                () => store.productsHistory.countAsync(),
                {
                    describe: `productsHistory grows by ${UPDATES} after ${UPDATES} content-changing updates`,
                    deadlineMs: 240_000,
                    intervalMs: 50,
                    stableSamples: 5,
                    render: count => String(count),
                }
            );

            note(`productsHistory ${beforeUpdates} -> ${afterUpdates} after ${UPDATES} content-changing updates`);

            expect(afterUpdates).toBe(beforeUpdates + UPDATES);

            // The view is one row per product, so a content change updates a row rather than
            // adding one. Its count must not have moved.
            expect(await store.productsView.countAsync()).toBe(PRODUCTS);

            // ---- Phase 5: a no-op save changes nothing -----------------------
            // The empty-send guard, stated as an invariant. A save with no pending changes
            // must not reach the views at all.
            //
            // Wait for the notification counters themselves to go quiet before taking the
            // baseline. Phase 4 waited for the history *count* to settle, which is not the same
            // thing: the rows can be final while a subscriber's re-query is still in flight, and
            // that straggler would land inside the no-op window below and be counted against it.
            // A first version of this took the baseline straight after phase 4 and failed
            // intermittently under load, which is the most misleading way for a test to be wrong
            // — the invariant is real, and the failure was in the way it was observed.
            await pollUntilStable(
                () => ({ view: viewObserved.notifications, history: historyObserved.notifications }),
                {
                    describe: 'view notifications go quiet before the no-op save',
                    deadlineMs: 30_000,
                    intervalMs: 25,
                    stableSamples: 8,
                    render: seen => JSON.stringify(seen),
                }
            );

            const notificationsBeforeNoop = {
                view: viewObserved.notifications,
                history: historyObserved.notifications,
            };

            await store.saveChangesAsync();
            await pollUntilStable(() => store.productsHistory.countAsync(), {
                describe: 'productsHistory count settles after a no-op save',
                deadlineMs: 5_000,
                intervalMs: 25,
                stableSamples: 5,
                render: count => String(count),
            });

            note(
                `no-op save produced ${viewObserved.notifications - notificationsBeforeNoop.view} view and ` +
                `${historyObserved.notifications - notificationsBeforeNoop.history} history notifications`
            );

            expect(await store.productsHistory.countAsync()).toBe(afterUpdates);
            expect(viewObserved.notifications).toBe(notificationsBeforeNoop.view);
            expect(historyObserved.notifications).toBe(notificationsBeforeNoop.history);

            // ---- Phase 6: subscribers converge on the final state ------------
            // The check the notification bound below cannot make. Notifications are heavily
            // coalesced (see the bound's comment), which is the right trade only if the LAST
            // one a subscriber receives reflects the settled data. A subscriber left holding
            // a stale count is the failure that coalescing risks, and it is invisible to a
            // count query against the view itself — the rows are correct, the subscriber
            // simply never heard about them.
            await pollUntil(
                () => ({ view: viewObserved.lastCount, history: historyObserved.lastCount }),
                seen => seen.view === PRODUCTS && seen.history === afterUpdates,
                {
                    describe: `subscribers observe the final state (productsView ${PRODUCTS}, productsHistory ${afterUpdates})`,
                    deadlineMs: 30_000,
                    intervalMs: 50,
                    render: seen => JSON.stringify(seen),
                }
            ).catch((error: Error) => {
                note(error.message);
                throw error;
            });

            // ---- Phase 7: the notification bound -----------------------------
            // Per the spec: the initial result, plus at most one notification per save that
            // changed the view. The saves that changed it are the BATCHES adds plus the one
            // update save. Anything above this is amplification — a subscriber hearing about
            // a save more than once, which grows with the run rather than with the writes.
            //
            // Measured, this passes by a wide margin rather than narrowly: 100 view-changing
            // saves produce TWO notifications per subscriber, because a send that arrives
            // while a subscriber's re-query is in flight is folded into that query's result
            // instead of queuing another one. So the bound is not tight, and it is not meant
            // to be — it is a ceiling that catches amplification, while phase 6 above is what
            // holds the coalescing honest. Read a failure here as "one save was heard many
            // times", never as "the count drifted by a few".
            const savesThatChangedTheView = BATCHES + 1;
            const bound = savesThatChangedTheView + 1;

            note(`notifications: productsView ${viewObserved.notifications}, productsHistory ${historyObserved.notifications} (bound ${bound})`);

            expect(viewObserved.notifications <= bound
                ? 'within bound'
                : `productsView subscriber fired ${viewObserved.notifications} times, bound is ${bound}`)
                .toBe('within bound');

            expect(historyObserved.notifications <= bound
                ? 'within bound'
                : `productsHistory subscriber fired ${historyObserved.notifications} times, bound is ${bound}`)
                .toBe('within bound');

            // A subscriber that never fired proves nothing about the bound above.
            expect(viewObserved.notifications).toBeGreaterThan(0);
            expect(historyObserved.notifications).toBeGreaterThan(0);
        }
    );
});
