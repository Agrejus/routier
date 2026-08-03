import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { IDbPlugin } from "@routier/core";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";

/**
 * Differential testing for query translation.
 *
 * Every query in the corpus runs twice: once through the plugin under test, and once
 * through a naive reference implementation written in plain JavaScript over the same rows.
 * Disagreement is the failure.
 *
 * This targets the class of bug where a plugin's translation is internally consistent but
 * disagrees with JS semantics — dexie applying `take` before `sort`, a SQL collation
 * ordering strings differently, a filter coercing `false`. Those survive hand-written
 * per-plugin tests because each plugin's suite asserts whatever that plugin already does.
 * A reference implementation has no such bias.
 */

export const oracleSchema = s.define("oracle_rows", {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    quantity: s.number(),
}).compile();

class OracleDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    rows = this.collection(oracleSchema).proxy().create();
}

export type OracleRow = {
    name: string;
    category: string;
    price: number;
    quantity: number;
};

/**
 * Fixed rows chosen to expose ordering and boundary disagreements: duplicate prices (tie
 * ordering), a zero and a negative (falsy and sign handling), mixed-case names (collation),
 * and more rows than any skip/take window so windows can be wrong without being empty.
 */
export const ORACLE_ROWS: OracleRow[] = [
    { name: "apple", category: "fruit", price: 10, quantity: 3 },
    { name: "Banana", category: "fruit", price: 30, quantity: 0 },
    { name: "cherry", category: "fruit", price: 20, quantity: 7 },
    { name: "Date", category: "dry", price: 20, quantity: 2 },
    { name: "elderberry", category: "dry", price: 0, quantity: 5 },
    { name: "Fig", category: "dry", price: 40, quantity: 1 },
    { name: "grape", category: "fruit", price: 15, quantity: 9 },
    { name: "Honeydew", category: "melon", price: 35, quantity: 4 },
];

type Predicate = {
    readonly label: string;
    /** Applied by the plugin. */
    readonly query: (r: any) => boolean;
    /** Applied by the reference implementation. Same logic, plain JS. */
    readonly reference: (r: OracleRow) => boolean;
};

const PREDICATES: Predicate[] = [
    { label: "none", query: () => true, reference: () => true },
    { label: "price > 20", query: (r: any) => r.price > 20, reference: r => r.price > 20 },
    { label: "price >= 20", query: (r: any) => r.price >= 20, reference: r => r.price >= 20 },
    { label: "price < 20", query: (r: any) => r.price < 20, reference: r => r.price < 20 },
    { label: "price === 20", query: (r: any) => r.price === 20, reference: r => r.price === 20 },
    { label: "price !== 20", query: (r: any) => r.price !== 20, reference: r => r.price !== 20 },
    { label: "price === 0", query: (r: any) => r.price === 0, reference: r => r.price === 0 },
    { label: "quantity === 0", query: (r: any) => r.quantity === 0, reference: r => r.quantity === 0 },
    { label: "category === fruit", query: (r: any) => r.category === "fruit", reference: r => r.category === "fruit" },
    { label: "category !== fruit", query: (r: any) => r.category !== "fruit", reference: r => r.category !== "fruit" },
    { label: "and", query: (r: any) => r.category === "fruit" && r.price > 15, reference: r => r.category === "fruit" && r.price > 15 },
    { label: "or", query: (r: any) => r.category === "melon" || r.price < 15, reference: r => r.category === "melon" || r.price < 15 },
    { label: "matches nothing", query: (r: any) => r.price > 1000, reference: r => r.price > 1000 },
];

type Ordering = {
    readonly label: string;
    /** null means the query applies no sort, so results are compared as sets. */
    readonly apply: ((q: any) => any) | null;
    readonly reference: ((a: OracleRow, b: OracleRow) => number) | null;
    /** The value being ordered on, used to compare orderings tie-tolerantly. */
    readonly key: ((r: OracleRow) => number) | null;
};

const ORDERINGS: Ordering[] = [
    { label: "unsorted", apply: null, reference: null, key: null },
    {
        label: "price asc",
        apply: q => q.sort((r: any) => r.price),
        reference: (a, b) => a.price - b.price,
        key: r => r.price,
    },
    {
        label: "price desc",
        apply: q => q.sortDescending((r: any) => r.price),
        reference: (a, b) => b.price - a.price,
        key: r => -r.price,
    },
    {
        label: "quantity asc",
        apply: q => q.sort((r: any) => r.quantity),
        reference: (a, b) => a.quantity - b.quantity,
        key: r => r.quantity,
    },
];

type Window = { readonly label: string; readonly skip: number; readonly take: number | null };

const WINDOWS: Window[] = [
    { label: "full", skip: 0, take: null },
    { label: "skip 2", skip: 2, take: null },
    { label: "take 3", skip: 0, take: 3 },
    { label: "skip 1 take 3", skip: 1, take: 3 },
    { label: "skip beyond end", skip: 100, take: null },
];

/** The reference implementation: plain JS over the seeded rows. */
function referenceResult(predicate: Predicate, ordering: Ordering, window: Window): OracleRow[] {
    let rows = ORACLE_ROWS.filter(predicate.reference);

    if (ordering.reference != null) {
        // Stable sort: Array.prototype.sort is stable in modern engines, so ties keep
        // insertion order and the expectation stays deterministic.
        rows = [...rows].sort(ordering.reference);
    }

    rows = rows.slice(window.skip);

    if (window.take != null) {
        rows = rows.slice(0, window.take);
    }

    return rows;
}

/** A comparable projection — plugin rows carry ids and tracking metadata the reference lacks. */
const project = (rows: any[]): OracleRow[] =>
    rows.map(r => ({ name: r.name, category: r.category, price: r.price, quantity: r.quantity }));

/** Order-insensitive key for comparing unsorted results. */
const asSet = (rows: OracleRow[]) => [...rows].map(r => r.name).sort();

export type QueryOracleOptions = {
    /** Corpus case labels this plugin is known to disagree on, registered with it.failing. */
    readonly knownFailing?: readonly string[];
    /**
     * Marks whole families of cases as known-failing.
     *
     * Needed when a plugin's disagreement is systematic but not reproducible case-by-case:
     * dexie returns a different wrong window on different runs, so an enumerated list flips
     * between "failing" and "unexpectedly passing" from run to run. A pattern states the
     * actual scope of the defect ("anything windowed") instead of a snapshot of one run.
     */
    readonly knownFailingPattern?: RegExp;
    /**
     * Reason this plugin's corpus is not run. Present and non-empty means skip the suite.
     *
     * A last resort, for when a plugin's disagreement cannot be expressed as per-test
     * expectations at all — a non-deterministically wrong result is neither reliably passing
     * nor reliably failing, so both `it` and `it.failing` churn. The reason is required so
     * the skip carries its own justification rather than becoming invisible.
     */
    readonly skipReason?: string;
};

export function describeQueryOracle(
    name: string,
    factory: () => IDbPlugin,
    options: QueryOracleOptions = {}
) {
    const knownFailing = new Set(options.knownFailing ?? []);
    const isKnownFailing = (label: string) =>
        knownFailing.has(label) || options.knownFailingPattern?.test(label) === true;

    const suite = options.skipReason != null && options.skipReason.length > 0 ? describe.skip : describe;

    suite(`query oracle: ${name}`, () => {
        let dataStore: OracleDataStore;

        beforeAll(async () => {
            // Seeded once for the whole corpus. Every case is a read, so sharing the store
            // keeps the corpus affordable on plugins with real I/O.
            dataStore = new OracleDataStore(factory());
            await dataStore.rows.addAsync(...(ORACLE_ROWS as any));
            await dataStore.saveChangesAsync();
        });

        afterAll(async () => {
            await dataStore?.destroyAsync().catch(() => undefined);
        });

        const build = (predicate: Predicate, ordering: Ordering, window: Window) => {
            let query: any = dataStore.rows;

            if (predicate.label !== "none") {
                query = query.where(predicate.query);
            }
            if (ordering.apply != null) {
                query = ordering.apply(query);
            }
            if (window.skip > 0) {
                query = query.skip(window.skip);
            }
            if (window.take != null) {
                query = query.take(window.take);
            }

            return query;
        };

        describe("result sets", () => {
            for (const predicate of PREDICATES) {
                for (const ordering of ORDERINGS) {
                    for (const window of WINDOWS) {
                        const label = `${predicate.label} | ${ordering.label} | ${window.label}`;
                        const register = isKnownFailing(label) ? it.failing : it;

                        register(label, async () => {
                            const actual = project(await build(predicate, ordering, window).toArrayAsync());
                            const expected = referenceResult(predicate, ordering, window);

                            const isWindowed = window.skip > 0 || window.take != null;

                            if (ordering.apply == null && isWindowed) {
                                // A window with no ordering has no well-defined answer: which
                                // rows `skip 2` drops depends on the store's natural order,
                                // which differs legitimately between an array, an IndexedDB
                                // primary-key cursor, and a SQL heap. Only the count and
                                // provenance are contractual here; the exact rows are not.
                                expect(actual).toHaveLength(expected.length);
                                const seeded = new Set(asSet(ORACLE_ROWS));
                                for (const key of asSet(actual)) {
                                    expect(seeded.has(key)).toBe(true);
                                }
                                return;
                            }

                            if (ordering.apply == null) {
                                // Unwindowed and unordered: the full matching set is fully
                                // determined, so compare as sets.
                                expect(asSet(actual)).toEqual(asSet(expected));
                                return;
                            }

                            // Ordered comparison, tie-tolerant. Sorting by price says the
                            // prices come back in order; it says nothing about the relative
                            // order of two rows sharing a price. The key sequence is fully
                            // determined and is asserted exactly.
                            expect(actual.map(ordering.key!)).toEqual(expected.map(ordering.key!));

                            if (isWindowed) {
                                // Which rows appear is NOT determined once a window boundary
                                // falls inside a tie group: with rows priced 0,10,15,20,20,...
                                // `skip 1 take 3` ends mid-tie, so either price-20 row is a
                                // correct third element. Asserting the exact set here would
                                // fail a plugin for picking the other one, which the ordering
                                // never promised. Membership is still checked, so a window
                                // cannot return rows that do not match the predicate.
                                const matching = new Set(asSet(ORACLE_ROWS.filter(predicate.reference)));
                                for (const key of asSet(actual)) {
                                    expect(matching.has(key)).toBe(true);
                                }
                                return;
                            }

                            // Unwindowed: every matching row must be present, so the set is
                            // fully determined even with ties.
                            expect(asSet(actual)).toEqual(asSet(expected));
                        });
                    }
                }
            }
        });

        describe("aggregates", () => {
            for (const predicate of PREDICATES) {
                const filtered = ORACLE_ROWS.filter(predicate.reference);

                const register = (suffix: string) =>
                    isKnownFailing(`${predicate.label} | ${suffix}`) ? it.failing : it;

                register("count")(`${predicate.label} | count`, async () => {
                    const query = predicate.label === "none" ? dataStore.rows : (dataStore.rows as any).where(predicate.query);
                    expect(await query.countAsync()).toBe(filtered.length);
                });

                if (filtered.length === 0) {
                    // sum/min/max over an empty set are their own contract question; the
                    // corpus covers the non-empty case and the contract kit covers empties.
                    continue;
                }

                register("sum")(`${predicate.label} | sum`, async () => {
                    const query = predicate.label === "none" ? dataStore.rows : (dataStore.rows as any).where(predicate.query);
                    expect(await query.sumAsync((r: any) => r.price)).toBe(
                        filtered.reduce((total, r) => total + r.price, 0)
                    );
                });

                register("min")(`${predicate.label} | min`, async () => {
                    const query = predicate.label === "none" ? dataStore.rows : (dataStore.rows as any).where(predicate.query);
                    expect(await query.minAsync((r: any) => r.price)).toBe(
                        Math.min(...filtered.map(r => r.price))
                    );
                });

                register("max")(`${predicate.label} | max`, async () => {
                    const query = predicate.label === "none" ? dataStore.rows : (dataStore.rows as any).where(predicate.query);
                    expect(await query.maxAsync((r: any) => r.price)).toBe(
                        Math.max(...filtered.map(r => r.price))
                    );
                });
            }
        });

        describe("existence", () => {
            for (const predicate of PREDICATES) {
                const filtered = ORACLE_ROWS.filter(predicate.reference);
                const label = `${predicate.label} | some`;
                const register = isKnownFailing(label) ? it.failing : it;

                register(label, async () => {
                    expect(await (dataStore.rows as any).someAsync(predicate.query)).toBe(filtered.length > 0);
                });
            }
        });
    });
}
