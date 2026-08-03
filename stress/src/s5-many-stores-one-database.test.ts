import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema, IDbPlugin } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { shapeCatalog } from '@routier/test-utils';
import {
    Backend,
    Oracle,
    RICH_BACKENDS,
    Rng,
    cleanupBackendArtifacts,
    compareToOracle,
    describeComparison,
    pollUntil,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S5 — many stores, one database.
 *
 * Everything before this owned its database. This is the shape a real application has when
 * two tabs, two windows, or a worker and its page all talk to the same store: several
 * `DataStore` instances over one database, each with live subscriptions, none aware of the
 * others.
 *
 * What that can break:
 *
 *  - **Broadcast storms.** Ten stores each notifying nine others on every save is quadratic
 *    if nobody filters. The bound here is on notification counts, not just on convergence.
 *  - **Channel refcounting.** `SchemaChannel.release` closes the shared BroadcastChannel when
 *    the last subscriber leaves. Off by one either way is a bug you cannot see from one
 *    store: release too eagerly and live subscriptions go deaf, too late and the channel
 *    holds the event loop open forever.
 *  - **Leaked handles.** This is the scenario the whole suite has been working around. Every
 *    stress run so far has needed `--forceExit` because something keeps Node alive after the
 *    tests finish, and `specs/stress-testing.md` names S5 as the place to turn that from a
 *    workaround into a tested invariant. So it is asserted here directly, against
 *    `process.getActiveResourcesInfo()`, rather than inferred from Jest's behaviour.
 */

/**
 * Backends that cannot yet hold several stores on one database, and the defect that stops
 * each. Pinned rather than skipped so the day it is fixed, the case fails "because it
 * passed" and this table has to be updated.
 */
// Defect #18 (file-system last-writer-wins) is fixed: the plugin keeps one collection
// instance per database path process-wide, so concurrent writers mutate one shared view
// and every save writes a superset of earlier ones. Empty until a new defect earns a row.
const KNOWN_FAILING: Partial<Record<string, number>> = {};

const STORES = 10;
const KEYS_PER_STORE = 20;
const ROUNDS = 10;

const shapeCase = () => {
    const found = shapeCatalog().find(c => c.spec.name === 'multi-scalar' && c.order === 'key-first');

    if (found == null) {
        throw new Error('Shape catalog has no case "multi-scalar [key-first]"');
    }

    return found;
};

class SharedStore extends DataStore {
    entities: any;

    constructor(plugin: IDbPlugin, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).create();
    }
}

type Row = { id: string; text: string; count: number; flag: boolean; at: Date };

const keyOf = (row: Row) => row.id;

const snapshot = (row: Row): Row => ({
    id: row.id, text: row.text, count: row.count, flag: row.flag, at: row.at,
});

/**
 * Active handles by type, which is how a leaked BroadcastChannel becomes visible.
 *
 * `getActiveResourcesInfo` is Node 18.19+. Where it is missing the leak assertion is skipped
 * rather than silently passing — a green result that measured nothing is worse than an
 * admitted gap.
 */
const handleCensus = (): Record<string, number> | null => {
    const get = (process as any).getActiveResourcesInfo;

    if (typeof get !== 'function') {
        return null;
    }

    const census: Record<string, number> = {};

    for (const kind of get.call(process) as string[]) {
        census[kind] = (census[kind] ?? 0) + 1;
    }

    return census;
};

/** Handle kinds that grew between two censuses. */
const grownHandles = (before: Record<string, number>, after: Record<string, number>) =>
    Object.keys(after)
        .filter(kind => (after[kind] ?? 0) > (before[kind] ?? 0))
        .map(kind => `${kind}: ${before[kind] ?? 0} -> ${after[kind]}`);

const openStores: SharedStore[] = [];
const unsubscribes: (() => void)[] = [];

afterEach(async () => {
    for (const unsubscribe of unsubscribes.splice(0)) {
        try { unsubscribe(); } catch { /* already torn down */ }
    }
    for (const store of openStores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

stressDescribe('S5 concurrency: many stores, one database', () => {
    for (const backend of RICH_BACKENDS) {
        stressIt(
            `${backend.name}: ${STORES} stores on one database converge on the union of their writes`,
            {
                seed: 20260805,
                scale: {
                    backend: backend.name,
                    stores: STORES,
                    keysPerStore: KEYS_PER_STORE,
                    rounds: ROUNDS,
                    totalEntities: STORES * KEYS_PER_STORE,
                },
                knownFailing: KNOWN_FAILING[backend.name],
            },
            async ({ note }) => {
                const { schema } = shapeCase();
                // One name, shared on purpose — the opposite of every other scenario, which
                // uses a uuid database name to stay isolated.
                const databaseName = backend.newDatabaseName();

                const stores = Array.from({ length: STORES }, () => {
                    const store = new SharedStore(backend.createShared(databaseName), schema);
                    openStores.push(store);
                    return store;
                });

                // Subscribers are created BEFORE the writes they must observe: a message sent
                // before a subscriber exists is dropped by the timestamp guard, so subscribing
                // afterwards would test nothing.
                const observed = stores.map(() => ({ notifications: 0, lastCount: -1 }));

                stores.forEach((store, i) => {
                    const unsubscribe = store.entities.subscribe().toArray((response: any) => {
                        observed[i].notifications++;

                        if (response.ok !== 'error') {
                            observed[i].lastCount = response.data.length;
                        }
                    });

                    if (typeof unsubscribe === 'function') {
                        unsubscribes.push(unsubscribe);
                    }
                });

                const oracles = stores.map(() => new Oracle<Row>(keyOf));

                // Each store owns a disjoint key range, so the final value of any row is
                // whatever its owner wrote last regardless of who flushed it.
                const keyFor = (store: number, index: number) => `s${String(store).padStart(2, '0')}-${index}`;

                for (let round = 0; round < ROUNDS; round++) {
                    await Promise.all(stores.map(async (store, i) => {
                        const rng = new Rng(20260805 + i * 31 + round);

                        if (round === 0) {
                            await store.entities.addAsync(
                                ...Array.from({ length: KEYS_PER_STORE }, (_, k) => ({
                                    id: keyFor(i, k),
                                    text: `seed-${i}-${k}`,
                                    count: 0,
                                    flag: false,
                                    at: new Date(Date.UTC(2020, 0, 1)),
                                }))
                            );
                        } else {
                            const mine = ((await store.entities.toArrayAsync()) as Row[])
                                .filter(row => row.id.startsWith(`s${String(i).padStart(2, '0')}-`));

                            for (const row of rng.sample(mine, Math.max(1, Math.floor(mine.length / 2)))) {
                                row.text = `s${i}-r${round}`;
                                row.count = round;
                            }
                        }

                        await store.saveChangesAsync();
                    }));
                }

                // Every store's own rows, read back once at the end.
                for (let i = 0; i < stores.length; i++) {
                    ((await stores[i].entities.toArrayAsync()) as Row[])
                        .filter(row => row.id.startsWith(`s${String(i).padStart(2, '0')}-`))
                        .forEach(row => oracles[i].set(snapshot(row)));
                }

                const union = new Oracle<Row>(keyOf);
                oracles.forEach(o => union.merge(o));
                const expectedTotal = STORES * KEYS_PER_STORE;

                note(`union oracle holds ${union.size} rows`);

                expect(union.size).toBe(expectedTotal);

                // Every store sees the whole database, not just its own writes.
                for (let i = 0; i < stores.length; i++) {
                    const seen = (await stores[i].entities.toArrayAsync()) as Row[];
                    const comparison = compareToOracle(union, seen, keyOf, { fields: ['text', 'count'] });

                    if (comparison.matches === false) {
                        note(`store ${i}: ${describeComparison(comparison)}`);
                    }

                    expect(comparison.matches ? 'oracle matches' : `store ${i}: ${describeComparison(comparison)}`)
                        .toBe('oracle matches');
                }

                // Subscriptions converge. Polled with a deadline rather than slept on, and the
                // failure reports the count each subscriber actually settled at.
                await pollUntil(
                    () => observed.map(o => o.lastCount),
                    counts => counts.every(c => c === expectedTotal),
                    {
                        describe: `all ${STORES} subscriptions report ${expectedTotal} rows`,
                        deadlineMs: 15_000,
                        intervalMs: 25,
                        render: counts => JSON.stringify(counts),
                    }
                ).catch((error: Error) => {
                    note(error.message);
                    throw error;
                });

                // Notification bound. Ten stores each saving ROUNDS times is 100 saves; a
                // subscriber that hears about every save from every store would be far above
                // this. The bound is generous on purpose — the hunt is quadratic amplification,
                // not an exact count.
                const bound = STORES * ROUNDS + STORES;
                const noisiest = Math.max(...observed.map(o => o.notifications));

                note(`notifications per subscriber: ${observed.map(o => o.notifications).join(', ')} (bound ${bound})`);

                expect(noisiest <= bound ? 'within bound' : `a subscriber fired ${noisiest} times, bound is ${bound}`)
                    .toBe('within bound');
            }
        );
    }

    stressIt(
        `memory: ${STORES} stores release every handle they opened`,
        {
            seed: 20260806,
            scale: { backend: 'memory', stores: STORES, keysPerStore: KEYS_PER_STORE },
        },
        async ({ note }) => {
            const { schema } = shapeCase();
            const backend: Backend = RICH_BACKENDS[0];
            const databaseName = backend.newDatabaseName();

            const before = handleCensus();

            if (before == null) {
                note('process.getActiveResourcesInfo is unavailable on this Node build — leak check skipped');
                return;
            }

            // Scoped so nothing survives the block by accident. The stores are NOT pushed onto
            // the shared cleanup list: tearing them down is what the test measures.
            const locals = Array.from({ length: STORES }, () => new SharedStore(backend.createShared(databaseName), schema));
            const teardown: (() => void)[] = [];

            for (let i = 0; i < locals.length; i++) {
                const unsubscribe = locals[i].entities.subscribe().toArray(() => { /* count not needed here */ });

                if (typeof unsubscribe === 'function') {
                    teardown.push(unsubscribe);
                }

                await locals[i].entities.addAsync(
                    ...Array.from({ length: KEYS_PER_STORE }, (_, k) => ({
                        id: `h${i}-${k}`, text: 't', count: 0, flag: false, at: new Date(Date.UTC(2020, 0, 1)),
                    }))
                );
                await locals[i].saveChangesAsync();
            }

            const during = handleCensus()!;

            note(`handles while open: ${grownHandles(before, during).join(', ') || 'none grew'}`);

            for (const unsubscribe of teardown) {
                unsubscribe();
            }

            for (const store of locals) {
                await store.destroyAsync();
                // Disposal is separate from destroy: destroy is the database's business,
                // dispose is the store's. A subscription channel is held by the store.
                store[Symbol.dispose]();
            }

            const after = pollAfterTeardown(before);
            const grown = await after;

            note(`handles after teardown: ${grown.join(', ') || 'back to baseline'}`);

            expect(grown.length === 0 ? 'no handles leaked' : `leaked ${grown.join(', ')}`)
                .toBe('no handles leaked');
        }
    );
});

/**
 * Teardown is not necessarily synchronous — a closing port can be reclaimed a tick later — so
 * the census is polled back to baseline rather than sampled once.
 */
const pollAfterTeardown = (before: Record<string, number>) =>
    pollUntil(
        () => grownHandles(before, handleCensus()!),
        grown => grown.length === 0,
        {
            describe: 'active handles return to their pre-test baseline',
            deadlineMs: 5_000,
            intervalMs: 50,
            render: grown => (grown as string[]).join(', ') || 'baseline',
        }
    ).catch(() => grownHandles(before, handleCensus()!));
