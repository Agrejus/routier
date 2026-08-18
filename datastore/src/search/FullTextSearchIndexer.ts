import { BulkPersistChanges } from "@routier/core/collections";
import { IDbPlugin, Query, QueryOptionsCollection } from "@routier/core/plugins";
import { CompiledSchema } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { Result } from "@routier/core/results";
import { UnknownRecord, uuid } from "@routier/core/utilities";
import { toExpression } from "@routier/core/expressions";
import { buildRows, FullTextSearchRegistration, readSourceId } from "../collection-builder/fullTextSearch";

/**
 * Rebuilds and audits a search index from the documents it describes.
 *
 * Steady-state maintenance runs in the save pipeline and is exact. This is the other half: a
 * recompute that compares the whole index against the whole corpus. Two things need it —
 * building an index over data that existed before the declaration, and repairing drift.
 *
 * Drift is possible for one reason: an add whose key the DATABASE assigns is indexed in a
 * follow-up write, so a process that dies between the two leaves a document with no index rows.
 * Nothing else can drift.
 *
 * Both operations read the RAW tables rather than going through the collections. That is
 * deliberate: a soft-deleted document belongs in the index — it is filtered out later, at the
 * read — and reading through a scoped collection would quietly delete its rows on every repair.
 */
export class FullTextSearchIndexer {

    constructor(
        private readonly registration: FullTextSearchRegistration,
        private readonly plugin: IDbPlugin,
        private readonly schemas: SchemaCollection
    ) { }

    /**
     * Every row of a collection, straight from the plugin, unscoped and untracked.
     *
     * `filter` is supplied for the index itself: PouchDB and browser-storage keep every
     * collection in one physical store, so an unfiltered read of the index returns the source
     * documents too — and a repair would then delete rows it should not.
     */
    private readAll(schema: CompiledSchema<any>, filter?: { selector: any; params: any }) {
        const options = new QueryOptionsCollection<any>();

        if (filter != null) {
            options.add("filter", {
                filter: filter.selector,
                expression: toExpression(schema, filter.selector, filter.params),
                params: filter.params
            });
        }

        return new Promise<UnknownRecord[]>((resolve, reject) => {
            this.plugin.query({
                operation: new Query<any, any>(options as any, schema),
                schemas: this.schemas,
                id: uuid(8),
                source: "Collection",
                action: "query",
                explain: false,
                executedQueries: []
            }, (result) => {

                if (result.ok === Result.ERROR) {
                    reject(result.error);
                    return;
                }

                resolve((result.data.value ?? []) as UnknownRecord[]);
            });
        });
    }

    /** The index's own rows, never another collection's. */
    private readIndex() {
        const documentType = this.registration.indexSchema.collectionName;

        return this.readAll(this.registration.indexSchema, {
            selector: ([row, p]: [any, any]) => row.documentType === p.documentType,
            params: { documentType }
        });
    }

    /** What the index should hold, keyed exactly as a stored row is. */
    private async expected() {
        const documents = await this.readAll(this.registration.sourceSchema);
        const rows = new Map<string, { _id: string; term: string; field: string; sourceId: string | number; frequency: number; documentType: string }>();

        for (const document of documents) {
            const sourceId = readSourceId(this.registration, document);

            if (sourceId == null) {
                continue;
            }

            for (const [key, row] of buildRows(this.registration, document, sourceId)) {
                rows.set(key, row);
            }
        }

        return rows;
    }

    /**
     * What is wrong with the index, without changing anything.
     *
     * Separate from `rebuild` on purpose. A repair that silently fixes drift also hides that
     * something is dropping writes; a check lets a scheduled job report it instead.
     */
    async check() {
        const expected = await this.expected();
        const stored = await this.readIndex();

        let extra = 0;
        let stale = 0;
        const seen = new Set<string>();

        for (const row of stored) {
            const key = String(row._id);
            const match = expected.get(key);

            if (match == null) {
                extra++;
                continue;
            }

            seen.add(key);

            if (match.frequency !== row.frequency) {
                stale++;
            }
        }

        return {
            /** Rows the corpus needs that the index does not have. */
            missing: expected.size - seen.size,
            /** Rows the index has that no document justifies. */
            extra,
            /** Rows present on both sides whose frequency disagrees. */
            stale,
            get isHealthy() {
                return this.missing === 0 && this.extra === 0 && this.stale === 0;
            },
        };
    }

    /**
     * Makes the index match the corpus, writing only the differences.
     *
     * Idempotent, and cheap when nothing has drifted — a healthy index costs two reads and no
     * write at all, which is what makes it safe to run on a schedule. The cost that is NOT
     * avoidable is reading every document to know what the index should contain, so this
     * belongs in a scheduled job rather than on a request path.
     */
    async rebuild() {
        const expected = await this.expected();
        const stored = await this.readIndex();

        const changes = new BulkPersistChanges();
        const target = changes.resolve(this.registration.indexSchema.id);
        const seen = new Set<string>();

        for (const row of stored) {
            const key = String(row._id);
            const match = expected.get(key);

            if (match == null) {
                target.removes.push(row as never);
                continue;
            }

            seen.add(key);

            if (match.frequency !== row.frequency) {
                target.updates.push({
                    // Built from the expected row but carrying the STORED revision. PouchDB
                    // updates by supplying a document's current `_rev`, and only the row that
                    // was read has one — a freshly computed row would conflict.
                    entity: this.registration.indexSchema.preprocess({ ...match, _rev: row._rev } as never),
                    delta: { frequency: match.frequency } as never,
                    changeType: "propertiesChanged",
                });
            }
        }

        for (const [key, row] of expected) {

            if (seen.has(key) === false) {
                target.adds.push(this.registration.indexSchema.preprocess(row as never) as never);
            }
        }

        const summary = {
            added: target.adds.length,
            updated: target.updates.length,
            removed: target.removes.length,
        };

        if (target.hasItems === false) {
            return summary;
        }

        await new Promise<void>((resolve, reject) => {
            this.plugin.bulkPersist({
                id: uuid(8),
                operation: changes,
                schemas: this.schemas,
                source: "DataStore",
                action: "persist"
            }, (result) => {

                if (result.ok === Result.ERROR) {
                    reject(result.error);
                    return;
                }

                resolve();
            });
        });

        return summary;
    }
}
