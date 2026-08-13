import { CompiledSchema, PropertyInfo, s, SchemaId, SchemaTypes } from "@routier/core/schema";
import { BulkPersistChanges, BulkPersistResult, SchemaPersistChanges } from "@routier/core/collections";
import { UnknownRecord } from "@routier/core/utilities";
import { countTerms, TokenizeOptions } from "../search/tokenize";

/**
 * Full-text search, declared on the collection whose text is searched.
 *
 * ```ts
 * articles = this.collection(articleSchema)
 *     .fullTextSearch()
 *     .proxy()
 *     .create();
 * ```
 *
 * The schema says what COULD be indexed — `s.string().searchable()` on a property — and this
 * says that it IS. Marking properties without declaring this costs nothing: no index exists and
 * no write pays for one.
 *
 * Every option has a default, so `.fullTextSearch()` with no argument is the whole opt-in.
 */

/** What `.fullTextSearch()` accepts. The same options the tokenizer takes, because it IS them. */
export type FullTextSearchOptions = TokenizeOptions;

/** The options that the built-in pipeline reads and a custom `tokenizer` replaces. */
const PIPELINE_OPTIONS = ["lowercase", "minTokenLength", "maxTokenLength", "stopWords"] as const;

export type FullTextSearchRegistration = {
    readonly sourceSchemaId: SchemaId;
    readonly sourceSchema: CompiledSchema<any>;
    /** Generated, never written by the caller. */
    readonly indexSchema: CompiledSchema<any>;
    /**
     * Root-level string properties marked `.searchable()`, in declaration order.
     *
     * Both names are needed and they are not always the same. `name` is what a caller writes
     * and what goes in the index row, so a field-scoped search selector resolves to it.
     * `column` is where the value actually lives in a serialized entity, which `.from()` can
     * rename.
     */
    readonly fields: readonly { readonly name: string; readonly column: string }[];
    readonly options: FullTextSearchOptions;
    /** Where the source key lives in a serialized entity. */
    readonly sourceKeyColumn: string;
};

/**
 * The index collection's schema, generated from the source.
 *
 * One row per (term, field, document). The key is `${term}|${field}|${sourceId}` and is
 * CALLER-SUPPLIED — built by whatever maintains the index — rather than `.computed()`.
 * `View` decides whether it accumulates history or mirrors its source by whether an id
 * property is computed (`datastore/src/views/View.ts`), and a computed key makes the view
 * append-only. An index keyed that way keeps terms from deleted documents forever.
 *
 * No positions column: phrase and proximity search are out for v1. Adding them later is not a
 * migration — the index is derived data, so a new column means bumping this schema and letting
 * the rebuild path refill an empty index.
 */
const buildIndexSchema = (sourceSchema: CompiledSchema<any>, sourceKey: PropertyInfo<any>) => {
    const definition = {
        /**
         * Named `_id` rather than `key`, which two backends require and none object to.
         *
         * PouchDB matches a write's response back to its operation by `entity._id`, so a
         * differently-named key makes every update and remove fail with "Cannot classify
         * resulting doc". MongoDB requires `_id` outright. A SQL backend just sees a column
         * name.
         *
         * 255 because MySQL makes a string column `VARCHAR(n)` and this one is the primary key.
         * The budget is term (≤255) + 1 + field name (≤100) + 1 + source key.
         */
        _id: s.string({ maxLength: 255 }).key(),
        term: s.string({ maxLength: 255 }).index("term"),
        field: s.string({ maxLength: 100 }),
        sourceId: sourceKey.type === SchemaTypes.Number ? s.number() : s.string({ maxLength: 255 }),
        frequency: s.number(),
        /**
         * Which collection a row belongs to, for backends that keep every collection in ONE
         * physical store — PouchDB and browser-storage.
         *
         * Those separate collections with a caller-declared discriminator, which the generated
         * index schema has no caller to declare. Without it, reading the index returns the
         * source documents too, and a repair deletes rows it should not. Every read of the
         * index filters on it; a backend with real tables simply has a column whose value never
         * varies.
         */
        documentType: s.string({ maxLength: 100 }),
        /**
         * A document revision, for the one backend whose write protocol needs one.
         *
         * PouchDB updates and deletes by supplying a document's current `_rev`, and a generated
         * schema has no caller to declare it — so without this every edit to an indexed document
         * conflicts. `.identity()` because the STORE assigns it: a backend that has no such
         * concept never writes it and the column stays empty.
         */
        _rev: s.string({ maxLength: 255 }).identity(),
    };

    return s.define(`${sourceSchema.collectionName}-search-index`, definition).compile();
};

/**
 * Validates the declaration and produces what the store needs to maintain the index.
 *
 * Every failure here is a declaration error — wrong at the moment it is written, not at the
 * moment a query runs — so each one throws with the reason rather than degrading to an index
 * that quietly returns nothing.
 */
export const resolveFullTextSearch = (
    sourceSchema: CompiledSchema<any>,
    options: FullTextSearchOptions = {}
): FullTextSearchRegistration => {

    const fields = sourceSchema.properties.filter(property => property.isSearchable);

    if (fields.length === 0) {
        // An index over nothing is a declaration error, not an empty index. The likeliest cause
        // is forgetting `.searchable()` on the properties, which no runtime symptom would name.
        throw new Error(
            `fullTextSearch() is declared on '${sourceSchema.collectionName}', which has no searchable properties.  ` +
            `Mark at least one string property with .searchable().`
        );
    }

    if (options.tokenizer != null) {
        const conflicting = PIPELINE_OPTIONS.filter(name => options[name] !== undefined);

        if (conflicting.length > 0) {
            // A custom tokenizer REPLACES the built-in pipeline, so these would be silently
            // ignored. Throwing makes the conflict impossible to write rather than impossible
            // to notice.
            throw new Error(
                `fullTextSearch() on '${sourceSchema.collectionName}' sets both tokenizer and ${conflicting.join(", ")}.  ` +
                `A tokenizer replaces the whole built-in pipeline, so those options would be ignored.`
            );
        }
    }

    const idProperties = sourceSchema.idProperties;

    if (idProperties.length !== 1) {
        // The index key embeds the source key. Composite keys can be added later without
        // changing any answer, so this is a v1 limit rather than a design decision.
        throw new Error(
            `fullTextSearch() on '${sourceSchema.collectionName}' requires a single key property, but the schema declares ${idProperties.length}.  ` +
            `Composite keys are not supported by full-text search in this version.`
        );
    }

    const [sourceKey] = idProperties;

    // Not a "must be string or number" check — the builder already guarantees that, since
    // `key()` exists only on `SchemaString`, `SchemaNumber` and a computed whose value is an
    // `IdType`. Computed is the one that compiles and cannot work: a key derived from the
    // entity CHANGES when the entity changes, so every index row for the old key is orphaned
    // by an ordinary edit and the document is findable under terms it no longer contains.
    if (sourceKey.type === SchemaTypes.Computed) {
        throw new Error(
            `fullTextSearch() on '${sourceSchema.collectionName}' requires a key that does not change with the entity, but '${sourceKey.name}' is computed.  ` +
            `Index rows embed the key, so a computed one strands them on every edit.`
        );
    }

    return {
        sourceSchemaId: sourceSchema.id,
        sourceSchema,
        indexSchema: buildIndexSchema(sourceSchema, sourceKey),
        fields: fields.map(field => ({ name: field.name, column: field.getResolvedName() })),
        options,
        sourceKeyColumn: sourceKey.getResolvedName(),
    };
};

/** One index row, before it is serialized for storage. */
type IndexRow = {
    _id: string;
    term: string;
    field: string;
    sourceId: string | number;
    frequency: number;
    documentType: string;
};

/**
 * The source key as it will appear in an index row, or null when there is not one yet.
 *
 * Null means an identity key on a row the database has not inserted, which is the only case
 * index maintenance has to defer.
 */
export const readSourceId = (registration: FullTextSearchRegistration, entity: UnknownRecord) => {
    const value = entity[registration.sourceKeyColumn];

    return value == null ? null : value as string | number;
};

/**
 * Every index row a document produces right now — one per (term, field), keyed so that the
 * same document and term always land on the same row.
 */
export const buildRows = (registration: FullTextSearchRegistration, entity: UnknownRecord, sourceId: string | number) => {
    const rows = new Map<string, IndexRow>();

    for (const field of registration.fields) {
        for (const [term, frequency] of countTerms(entity[field.column], registration.options)) {
            const key = `${term}|${field.name}|${sourceId}`;

            rows.set(key, {
                _id: key, term, field: field.name, sourceId, frequency,
                documentType: registration.indexSchema.collectionName,
            });
        }
    }

    return rows;
};

/**
 * What has to change in the index for one edited document.
 *
 * Only the fields named in `previous` are looked at, which is the whole point of carrying it:
 * editing a title re-tokenises the title and leaves a 4000-character body alone. Diff-tracked
 * collections name every root, so they re-tokenise everything — the same "assume everything"
 * their empty delta already means.
 */
const diffRows = (
    registration: FullTextSearchRegistration,
    previous: UnknownRecord,
    entity: UnknownRecord,
    sourceId: string | number,
    emitted: SchemaPersistChanges<any>
) => {
    const changed = registration.fields.filter(field => field.column in previous);

    if (changed.length === 0) {
        return;
    }

    const scoped = { ...registration, fields: changed };
    const before = buildRows(scoped, previous, sourceId);
    const after = buildRows(scoped, entity, sourceId);

    for (const [key, row] of after) {
        const existing = before.get(key);

        if (existing == null) {
            emitted.adds.push(registration.indexSchema.preprocess(row as never));
            continue;
        }

        if (existing.frequency !== row.frequency) {
            emitted.updates.push({
                entity: registration.indexSchema.preprocess(row as never),
                delta: { frequency: row.frequency } as never,
                changeType: "propertiesChanged",
            });
        }
    }

    // The terms that LEFT. Without `previous` these are unknowable, and the document stays
    // findable for ever by words it no longer contains.
    for (const [key, row] of before) {

        if (after.has(key) === false) {
            emitted.removes.push(registration.indexSchema.preprocess(row as never));
        }
    }
};

/**
 * Every full-text search declaration in one store.
 *
 * Shared by every collection the way `AuditRegistry` is, because index maintenance runs once
 * per SAVE rather than once per collection — the changes have to be fully assembled first.
 */
export class FullTextSearchRegistry {

    private readonly registrations = new Map<SchemaId, FullTextSearchRegistration>();
    /**
     * Rows appended per index schema in the save currently in flight, so `detach` can take
     * exactly those back out. Cleared at the start of every save, so a failed one cannot leave
     * a count behind that corrupts the next.
     */
    private appended = new Map<SchemaId, { adds: number; updates: number; removes: number }>();
    /**
     * Source ids whose added document was already indexed in the save itself.
     *
     * `deferredAdds` reads the RESOLVED adds, which include every add — not only the ones that
     * had to wait for a key. Without this set, a collection with a caller-supplied key indexes
     * each new document twice: once in its own transaction and once again afterwards.
     */
    private indexedAdds = new Map<SchemaId, Set<string>>();

    get isEmpty() {
        return this.registrations.size === 0;
    }

    register(registration: FullTextSearchRegistration) {

        if (this.registrations.has(registration.sourceSchemaId)) {
            // Two declarations would build two indexes over one collection and both would
            // maintain rows in the same table, with whichever ran last deciding the tokenizer.
            throw new Error(
                `fullTextSearch() is declared more than once on '${registration.sourceSchema.collectionName}'.  Declare it once.`
            );
        }

        this.registrations.set(registration.sourceSchemaId, registration);
    }

    get(sourceSchemaId: SchemaId) {
        return this.registrations.get(sourceSchemaId);
    }

    values() {
        return this.registrations.values();
    }

    /**
     * Turns one save's changes into index rows and appends them to the same save.
     *
     * Runs at the same pipeline site as `AuditRegistry.apply`, after the prepare pipeline, so
     * the batch is complete. Appending here rather than writing separately is what makes the
     * index commit with the documents on any backend with an atomic batch.
     *
     * Adds whose key the DATABASE assigns cannot be done here — there is no id yet to put in
     * the row's key. Those come back from `deferredAdds` once the save has resolved them.
     */
    apply(changes: BulkPersistChanges) {
        this.appended.clear();
        this.indexedAdds.clear();

        if (this.registrations.size === 0) {
            return;
        }

        for (const registration of this.registrations.values()) {
            const source = changes.get(registration.sourceSchemaId);

            if (source == null || source.hasItems === false) {
                continue;
            }

            const emitted = new SchemaPersistChanges<any>();

            const indexedAdds = new Set<string>();

            for (const add of source.adds) {
                const sourceId = readSourceId(registration, add as UnknownRecord);

                if (sourceId == null) {
                    // Identity key: no id until the database assigns one. Handled after.
                    continue;
                }

                indexedAdds.add(String(sourceId));

                for (const row of buildRows(registration, add as UnknownRecord, sourceId).values()) {
                    emitted.adds.push(registration.indexSchema.preprocess(row as never));
                }
            }

            this.indexedAdds.set(registration.sourceSchemaId, indexedAdds);

            for (const update of source.updates) {
                const entity = update.entity as UnknownRecord;
                const sourceId = readSourceId(registration, entity);

                if (sourceId == null || update.previous == null) {
                    continue;
                }

                diffRows(registration, update.previous as UnknownRecord, entity, sourceId, emitted);
            }

            for (const remove of source.removes) {
                const sourceId = readSourceId(registration, remove as UnknownRecord);

                if (sourceId == null) {
                    continue;
                }

                // Every row this document put in the index, derived from the document itself
                // rather than read back — a read here would make the save asynchronous for the
                // one case that does not need it.
                for (const row of buildRows(registration, remove as UnknownRecord, sourceId).values()) {
                    emitted.removes.push(registration.indexSchema.preprocess(row as never));
                }
            }

            if (emitted.hasItems === false) {
                continue;
            }

            const target = changes.resolve(registration.indexSchema.id);

            // Appended to the END, which is what lets them be identified again in `detach`.
            target.adds.push(...emitted.adds as never[]);
            target.updates.push(...emitted.updates as never[]);
            target.removes.push(...emitted.removes as never[]);

            this.appended.set(registration.indexSchema.id, {
                adds: emitted.adds.length,
                updates: emitted.updates.length,
                removes: emitted.removes.length,
            });
        }
    }

    /**
     * Index rows for adds whose key the database assigned, ready for a follow-up write.
     *
     * The one thing that cannot ride the document's own transaction: the row's key embeds the
     * source id, and for an identity key that id does not exist until the insert has run. Read
     * from the RESOLVED adds, which carry what the database chose.
     */
    deferredAdds(result: BulkPersistResult): BulkPersistChanges | null {
        const deferred = new BulkPersistChanges();
        let hasAny = false;

        for (const registration of this.registrations.values()) {
            const persisted = result.get(registration.sourceSchemaId);

            if (persisted == null || persisted.adds.length === 0) {
                continue;
            }

            const target = deferred.resolve(registration.indexSchema.id);
            const already = this.indexedAdds.get(registration.sourceSchemaId);

            for (const add of persisted.adds) {
                const sourceId = readSourceId(registration, add as UnknownRecord);

                if (sourceId == null || already?.has(String(sourceId)) === true) {
                    // Already indexed inside the save itself — its key existed all along.
                    continue;
                }

                for (const row of buildRows(registration, add as UnknownRecord, sourceId).values()) {
                    target.adds.push(registration.indexSchema.preprocess(row as never) as never);
                    hasAny = true;
                }
            }
        }

        return hasAny ? deferred : null;
    }

    /**
     * Takes the emitted rows back out of the save, before anything else looks at it.
     *
     * Exactly `AuditRegistry.detach`'s reason: nothing tracks these rows, so a store that also
     * declares a collection over the index schema would try to match rows its change tracker
     * never sent, and the caller's reported counts would include rows they did not make.
     */
    detach(changes: BulkPersistChanges, result: BulkPersistResult | undefined) {
        for (const [schemaId, counts] of this.appended) {
            const pending = changes.get(schemaId);

            if (pending != null) {
                pending.adds.splice(Math.max(0, pending.adds.length - counts.adds), counts.adds);
                pending.updates.splice(Math.max(0, pending.updates.length - counts.updates), counts.updates);
                pending.removes.splice(Math.max(0, pending.removes.length - counts.removes), counts.removes);
            }

            const persisted = result?.get(schemaId);

            if (persisted != null) {
                persisted.adds.splice(Math.max(0, persisted.adds.length - counts.adds), counts.adds);
                persisted.updates.splice(Math.max(0, persisted.updates.length - counts.updates), counts.updates);
                persisted.removes.splice(Math.max(0, persisted.removes.length - counts.removes), counts.removes);
            }
        }

        this.appended.clear();
    }
}
