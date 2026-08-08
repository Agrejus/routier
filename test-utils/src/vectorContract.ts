import { afterEach, describe, expect, it } from "@jest/globals";
import { IDbPlugin } from "@routier/core";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";

/**
 * The vector-search suite every backend must pass, whether or not it knows what a vector is.
 *
 * Separate from `describePluginContract` on purpose, and not merely for tidiness. The contract
 * store declares a composite-key schema, and PouchDB rejects a composite key for the whole
 * event rather than for that one collection — so a backend that cannot do composite keys
 * cannot run any of the contract, vectors included. Since "works everywhere" is the entire
 * claim being tested here, the suite that tests it must not inherit an unrelated reason to be
 * unrunnable.
 *
 * One schema, one collection, no identity beyond the key. Everything a backend needs in order
 * to be asked the only question this file asks.
 */

export const vectorContractSchema = s.define("contract_vectors", {
    _id: s.string().key().identity(),
    label: s.string(),
    embedding: s.vector(3),
}).compile();

/**
 * The same shape carrying a document revision, for stores that need one to write twice.
 *
 * PouchDB is the case: a document is updated by supplying its current `_rev`, so a schema
 * without one can be created and read but every update conflicts. That is a fact about the
 * store's write protocol and has nothing to do with vectors — declaring it here keeps the
 * backend in this suite rather than exempting it from the one claim the suite exists to check.
 *
 * Spelled out as a second schema rather than spread into the first so both stay fully typed.
 */
export const vectorContractRevisionSchema = s.define("contract_vectors", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    label: s.string(),
    embedding: s.vector(3),
}).compile();

class VectorDataStore extends DataStore {
    vectors = this.collection(vectorContractSchema).proxy().create();
}

class RevisionVectorDataStore extends DataStore {
    vectors = this.collection(vectorContractRevisionSchema).proxy().create();
}

type VectorRow = { label: string, embedding: number[] };

/**
 * Unit axes plus one diagonal and one opposite, so every expected order below is an angle you
 * can read rather than a distance you have to trust.
 *
 * From `[1, 0, 0]`: `x` at 0°, `xy` at 45°, `y` and `z` both at 90°, `negative-x` at 180°.
 * That 90° tie is deliberate — assertions cut above or below it, never through it, because
 * equal distances are not promised to order the same way on two engines.
 */
const VECTORS: VectorRow[] = [
    { label: "x", embedding: [1, 0, 0] },
    { label: "y", embedding: [0, 1, 0] },
    { label: "z", embedding: [0, 0, 1] },
    { label: "xy", embedding: [1, 1, 0] },
    { label: "negative-x", embedding: [-1, 0, 0] },
];

export type VectorContractOptions = {
    /**
     * Test names this backend is known not to satisfy, registered with `it.failing` so they
     * stay in the report and fail loudly once fixed. Prefer this over removing a case.
     */
    readonly knownFailing?: readonly string[];
    /**
     * Whether this store needs a `_rev` property declared to accept an update.
     *
     * A write-protocol requirement, not a capability: see `vectorContractRevisionSchema`.
     */
    readonly requiresDocumentRevision?: boolean;
    /**
     * Set when the plugin was handed a connection it does not own, so this suite must not
     * destroy the stores it opens.
     *
     * `destroy()` is a plugin's teardown, and what that means varies: most release their own
     * resources, but `MongoDbPlugin` drops the database AND closes the client — correct for a
     * plugin that opened its own, fatal for one given a caller's shared `MongoClient`. The
     * first test would close it and every later one fails with "Client must be connected".
     *
     * Leaving the stores alone is safe because `seeded` clears rows before it writes, so
     * isolation never depended on teardown in the first place.
     */
    readonly borrowsConnection?: boolean;
};

/**
 * Registers the vector-search suite against one plugin.
 *
 * @param name How this backend is labelled in the report.
 * @param factory Builds a fresh plugin. Called once per test, so no case can see another's rows.
 */
export function describeVectorSearch(
    name: string,
    factory: () => IDbPlugin,
    options: VectorContractOptions = {}
) {
    const knownFailing = new Set(options.knownFailing ?? []);
    const test = (title: string, body: () => Promise<void>) => {
        (knownFailing.has(title) ? it.failing : it)(title, body as any);
    };

    const Store: new (plugin: IDbPlugin) => VectorDataStore = options.requiresDocumentRevision === true
        ? RevisionVectorDataStore as never
        : VectorDataStore;

    describe(`vector search: ${name}`, () => {
        const stores: VectorDataStore[] = [];

        const seeded = async () => {
            const store = new Store(factory());
            stores.push(store);

            // Clear before seeding, because a fresh plugin is not a fresh database.
            //
            // An in-process backend gets a new store per factory call — the name carries a
            // uuid — so isolation is free. A server-backed one does not: every plugin points
            // at the same schema on the same host, and `destroy()` ends a connection pool
            // rather than dropping a table. Without this, each test seeds five more rows on
            // top of the last, and the counts drift while the orderings stay plausible.
            const existing = await store.vectors.toArrayAsync();

            if (existing.length > 0) {
                await store.vectors.removeAsync(...existing);
                await store.saveChangesAsync();
            }

            await store.vectors.addAsync(...(VECTORS as any));
            await store.saveChangesAsync();

            return store;
        };

        afterEach(async () => {
            const opened = stores.splice(0);

            if (options.borrowsConnection === true) {
                return;
            }

            await Promise.all(opened.map(async store => {
                try {
                    await store.destroyAsync();
                } catch {
                    // A store that cannot be torn down is asserted elsewhere; failing here
                    // would replace a real result with a teardown error.
                }
            }));
        });

        test("round-trips a vector as numbers", async () => {
            const found = await (await seeded()).vectors.firstAsync(v => v.label === "xy");

            // A store that JSON-encodes the column must decode it again. Arriving as
            // "[1,1,0]" is invisible to every ordering test below, which reads only labels.
            expect(found.embedding).toEqual([1, 1, 0]);
            expect(found.embedding.every((n: number) => typeof n === "number")).toBe(true);
        });

        test("orders by similarity, nearest first", async () => {
            const found = await (await seeded()).vectors.nearest(v => v.embedding, [1, 0, 0], 2).toArrayAsync();

            expect(found.map(v => v.label)).toEqual(["x", "xy"]);
        });

        test("orders from the query vector rather than a fixed point", async () => {
            // The same rows against the opposite query must invert. A backend that ignored the
            // search and returned insertion order passes the case above on luck alone; it
            // cannot pass both.
            //
            // Only the ends are asserted: from [-1,0,0] the middle is y and z tied at 90°.
            const found = await (await seeded()).vectors.nearest(v => v.embedding, [-1, 0, 0], 5).toArrayAsync();

            expect(found[0].label).toBe("negative-x");
            expect(found[found.length - 1].label).toBe("x");
        });

        test("limits to the requested count", async () => {
            const found = await (await seeded()).vectors.nearest(v => v.embedding, [1, 1, 0], 1).toArrayAsync();

            expect(found.map(v => v.label)).toEqual(["xy"]);
        });

        test("returns every row when asked for more than exist", async () => {
            const found = await (await seeded()).vectors.nearest(v => v.embedding, [1, 0, 0], 100).toArrayAsync();

            expect(found).toHaveLength(VECTORS.length);
        });

        test("searches only what a filter selected", async () => {
            const found = await (await seeded()).vectors
                .where(v => v.label !== "x")
                .nearest(v => v.embedding, [1, 0, 0], 1)
                .toArrayAsync();

            // 'x' is the nearest row overall, so its absence is what proves the filter ran
            // first rather than being applied to an already-truncated result.
            expect(found.map(v => v.label)).toEqual(["xy"]);
        });

        test("applies a take after the search rather than before it", async () => {
            const found = await (await seeded()).vectors
                .sort(v => v.label)
                .nearest(v => v.embedding, [1, 0, 0], 3)
                .take(2)
                .toArrayAsync();

            // Sorted by label the first rows are 'negative-x' and 'x'. A take pushed to the
            // store truncates before scoring and cannot produce this answer.
            expect(found.map(v => v.label)).toEqual(["x", "xy"]);
        });

        test("puts a row with no direction last rather than dropping it", async () => {
            const store = await seeded();
            await store.vectors.addAsync({ label: "empty", embedding: [0, 0, 0] } as any);
            await store.saveChangesAsync();

            const found = await store.vectors.nearest(v => v.embedding, [1, 0, 0], 6).toArrayAsync();

            // A zero-magnitude vector has no direction, so its distance is undefined. It must
            // still come back — sorted last — because a query asking for six rows out of six
            // should not quietly return five.
            expect(found).toHaveLength(6);
            expect(found[found.length - 1].label).toBe("empty");
        });

        test("updates an embedding in place", async () => {
            const store = await seeded();
            const row = await store.vectors.firstAsync(v => v.label === "z");

            row.embedding = [1, 0, 0];
            await store.saveChangesAsync();

            // Replacing an embedding has to produce a diff. A backend that cloned the array by
            // reference shares it with the change tracker's copy, so this save reports nothing
            // to do and the search below still returns the old ordering.
            const found = await store.vectors.nearest(v => v.embedding, [1, 0, 0], 2).toArrayAsync();

            expect(found.map(v => v.label).sort()).toEqual(["x", "z"]);
        });
    });
}
