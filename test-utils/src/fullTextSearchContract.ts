import { afterEach, describe, expect, it } from "@jest/globals";
import { IDbPlugin } from "@routier/core";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";

/**
 * The full-text search suite every backend must pass, identically.
 *
 * "Same answer everywhere" is the whole claim, and it is only worth anything if one set of
 * expectations runs against every backend rather than one set per backend. No plugin contains
 * any search code — core tokenises, core ranks, and the engine sees an ordinary `IN` filter over
 * an ordinary table — so a backend that disagrees here has a bug somewhere far more general
 * than search.
 *
 * Separate from `describePluginContract` for the same reason `describeVectorSearch` is: the
 * contract store declares a composite key, which PouchDB rejects for the whole event, so a
 * backend that cannot run the contract would be silently exempt from the one claim this file
 * makes.
 *
 * A caller-supplied key, not an identity: an identity-keyed add is indexed in a follow-up write,
 * and that is a property of key assignment rather than of the backend. Testing it here would
 * measure the same thing on all ten.
 */

export const searchContractSchema = s.define("contract_search", {
    _id: s.string().key(),
    title: s.string().searchable(),
    body: s.string({ maxLength: 4000 }).searchable(),
    note: s.string(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

/** The same shape carrying a revision, for stores whose write protocol needs one. */
export const searchContractRevisionSchema = s.define("contract_search", {
    _id: s.string().key(),
    _rev: s.string().identity(),
    title: s.string().searchable(),
    body: s.string({ maxLength: 4000 }).searchable(),
    note: s.string(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

/**
 * The `documentType` scope follows the shape every suite in this repository uses for PouchDB and
 * browser-storage: one physical database holds every collection, so a collection has to filter
 * itself out of it. Harmless on a backend with real tables, and required on the two without —
 * without it a source read returns the search index's own rows.
 */
class SearchDataStore extends DataStore {
    documents = this.collection(searchContractSchema)
        .fullTextSearch()
        .scope(([x, p]) => x.documentType === p.collectionName, { ...searchContractSchema })
        .proxy()
        .create();
}

class RevisionSearchDataStore extends DataStore {
    documents = this.collection(searchContractRevisionSchema)
        .fullTextSearch()
        .scope(([x, p]) => x.documentType === p.collectionName, { ...searchContractRevisionSchema })
        .proxy()
        .create();
}

type Row = { _id: string; title: string; body: string; note: string };

/**
 * Frequencies chosen so every expected ORDER below is arithmetic you can check by reading,
 * not a ranking you have to trust.
 *
 * "copper" totals: a=3, b=2, c=1. No ties among them, because two engines are not promised to
 * order equal scores the same way — the tie-break is asserted separately, where the keys make
 * the answer total.
 *
 * `note` is deliberately full of words that appear nowhere else and is NOT searchable, so a
 * backend that indexed everything would fail loudly rather than merely return more rows.
 */
const ROWS: Row[] = [
    { _id: "a", title: "copper pipe", body: "copper copper fitting", note: "zebra" },
    { _id: "b", title: "copper rod", body: "copper", note: "zebra" },
    { _id: "c", title: "steel beam", body: "copper trace", note: "zebra" },
    { _id: "d", title: "timber frame", body: "oak", note: "zebra" },
];

export type FullTextSearchContractOptions = {
    /** Cases this backend is known not to satisfy, registered with `it.failing`. */
    readonly knownFailing?: readonly string[];
    /** Whether this store needs a `_rev` property declared to accept an update. */
    readonly requiresDocumentRevision?: boolean;
    /** Set when the plugin was handed a connection it does not own — see the vector suite. */
    readonly borrowsConnection?: boolean;
};

/**
 * Registers the full-text search suite against one plugin.
 *
 * @param name How this backend is labelled in the report.
 * @param factory Builds a fresh plugin. Called once per test, so no case sees another's rows.
 */
export function describeFullTextSearch(
    name: string,
    factory: () => IDbPlugin,
    options: FullTextSearchContractOptions = {}
) {
    const knownFailing = new Set(options.knownFailing ?? []);
    const test = (title: string, body: () => Promise<void>) => {
        (knownFailing.has(title) ? it.failing : it)(title, body as any);
    };

    const Store: new (plugin: IDbPlugin) => SearchDataStore = options.requiresDocumentRevision === true
        ? RevisionSearchDataStore as never
        : SearchDataStore;

    describe(`full-text search: ${name}`, () => {
        const stores: SearchDataStore[] = [];

        const seeded = async () => {
            const store = new Store(factory());
            stores.push(store);

            // Cleared before seeding: a fresh plugin is not a fresh database. A server-backed
            // backend points every plugin at the same table, so without this each case seeds
            // four more rows and the counts drift while the orderings stay plausible.
            const existing = await store.documents.toArrayAsync();

            if (existing.length > 0) {
                await store.documents.removeAsync(...existing);
                await store.saveChangesAsync();
            }

            await store.documents.addAsync(...ROWS.map(row => ({ ...row })));
            await store.saveChangesAsync();

            return store;
        };

        /**
         * Every store this suite opened, torn down after each case.
         *
         * Not optional tidiness: a backend that owns a FILE leaves one behind per store
         * otherwise, and this suite opens one per test. Without it a full run littered the
         * repository root with 182 SQLite databases.
         */
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

        test("finds documents containing a term", async () => {
            const store = await seeded();
            const hits = await store.documents.search("copper").toArrayAsync();

            expect(hits.map(hit => hit._id).sort()).toEqual(["a", "b", "c"]);
        });

        test("ranks by total term frequency", async () => {
            const store = await seeded();
            const hits = await store.documents.search("copper").toArrayAsync();

            expect(hits.map(hit => hit._id)).toEqual(["a", "b", "c"]);
            expect(hits.map(hit => hit.score)).toEqual([3, 2, 1]);
        });

        test("requires every term by default", async () => {
            const store = await seeded();
            const hits = await store.documents.search("copper pipe").toArrayAsync();

            expect(hits.map(hit => hit._id)).toEqual(["a"]);
        });

        test("accepts any term when asked", async () => {
            const store = await seeded();
            const hits = await store.documents.search("copper timber", { match: "any" }).toArrayAsync();

            expect(hits.map(hit => hit._id).sort()).toEqual(["a", "b", "c", "d"]);
        });

        test("scopes to one field", async () => {
            const store = await seeded();
            const hits = await store.documents.search(x => x.title, "copper").toArrayAsync();

            expect(hits.map(hit => hit._id).sort()).toEqual(["a", "b"]);
        });

        test("ignores properties that are not searchable", async () => {
            const store = await seeded();

            // Every row's `note` is "zebra", and `note` has no `.searchable()`. A backend that
            // indexed the whole document would return all four.
            expect(await store.documents.search("zebra").toArrayAsync()).toEqual([]);
        });

        test("returns nothing for a query with no terms", async () => {
            const store = await seeded();

            expect(await store.documents.search("").toArrayAsync()).toEqual([]);
        });

        test("breaks ties by key, the same way every time", async () => {
            const store = await seeded();

            // "trace" and "oak" appear once each in different documents, so a query matching
            // both scores them equally — the key decides, and it decides identically on every
            // engine because core does the ordering.
            const hits = await store.documents.search("trace oak", { match: "any" }).toArrayAsync();

            expect(hits.map(hit => hit._id)).toEqual(["c", "d"]);
        });

        test("drops the terms of an edited field", async () => {
            const store = await seeded();
            const [document] = await store.documents.where(x => x._id === "b").toArrayAsync();

            document.title = "steel rod";
            await store.saveChangesAsync();

            // "b" no longer says copper in its title, but its body still does.
            const hits = await store.documents.search(x => x.title, "copper").toArrayAsync();

            expect(hits.map(hit => hit._id)).toEqual(["a"]);
        });

        test("forgets a removed document", async () => {
            const store = await seeded();
            const [document] = await store.documents.where(x => x._id === "a").toArrayAsync();

            await store.documents.removeAsync(document);
            await store.saveChangesAsync();

            const hits = await store.documents.search("copper").toArrayAsync();

            expect(hits.map(hit => hit._id)).toEqual(["b", "c"]);
        });

        test("indexes a term longer than the token cap by its prefix", async () => {
            // The MySQL case the spec calls out: the index key is a VARCHAR(255) primary key,
            // so a long token is truncated to `maxTokenLength` rather than dropped. Asserted on
            // every backend, because truncation happens in core and the answer must not depend
            // on which engine stores the row.
            const store = await seeded();
            const long = "z".repeat(200);

            await store.documents.addAsync({ _id: "long", title: long, body: "", note: "" });
            await store.saveChangesAsync();

            // Findable by the first 64 characters — the default cap — and not by 200.
            const byPrefix = await store.documents.search("z".repeat(64)).toArrayAsync();

            expect(byPrefix.map(hit => hit._id)).toEqual(["long"]);
        });

        test("reports a healthy index as healthy", async () => {
            const store = await seeded();

            expect(await store.documents.fullTextSearch.check()).toMatchObject({
                missing: 0, extra: 0, stale: 0, isHealthy: true,
            });
        });

        test("rebuilds to the same index maintenance produced", async () => {
            // Two code paths write these rows. If they disagree, a search returns different
            // answers depending on how the data arrived — and nothing else would notice.
            const store = await seeded();

            const before = await store.documents.search("copper").toArrayAsync();
            const summary = await store.documents.fullTextSearch.rebuild();
            const after = await store.documents.search("copper").toArrayAsync();

            expect(summary).toEqual({ added: 0, updated: 0, removed: 0 });
            expect(after.map(hit => `${hit._id}:${hit.score}`)).toEqual(before.map(hit => `${hit._id}:${hit.score}`));
        });
    });
}
