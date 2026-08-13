import { IDbPlugin, Query, QueryOptionsCollection } from "@routier/core/plugins";
import { CompiledSchema, ChangeTrackingType, InferType } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { Result } from "@routier/core/results";
import { GenericFunction } from "@routier/core/types";
import { UnknownRecord, uuid } from "@routier/core/utilities";
import { ComparatorExpression, Expression, Filter, ParamsFilter, PropertyExpression, toExpression, ValueExpression } from "@routier/core/expressions";
import { FullTextSearchRegistration } from "../collection-builder/fullTextSearch";
import { CollectionDependencies, RequestContext } from "../collections/types";
import { QueryableAsync } from "../queryable/QueryableAsync";
import { tokenize } from "./tokenize";

/** How many of the query's terms a document must match. */
export type SearchOptions = {
    /**
     * `"all"` (default) keeps documents matching every term — what a search box means.
     * `"any"` keeps documents matching at least one, where matching more simply scores higher.
     */
    match?: "all" | "any";
};

/** An entity plus its relevance. `score` is readonly and never persisted. */
export type Scored<T> = T & { readonly score: number };

/**
 * Pulls `body` out of `x => x.body`, the same source-text technique `.softDelete()` and
 * `.sort()` use.
 */
const propertyNameFrom = (selector: GenericFunction<any, unknown>): string => {
    const stringified = selector.toString();
    const arrowIndex = stringified.indexOf("=>");

    if (arrowIndex < 0) {
        throw new Error("Only arrow functions are allowed in .search()");
    }

    const [, ...path] = stringified.substring(arrowIndex + 2).trim().split(".");

    return path.join(".");
};

/**
 * A search, composable like a query and executed when a terminal is called.
 *
 * ## Why everything after the search runs in memory
 *
 * The ordering is a score this datastore computes from index rows, so a backend cannot know it.
 * That makes `sort`, `skip`, `take` and `map` the same case as an option after `.nearest()`:
 * pushing `LIMIT 3` down to a backend that never saw the ranking returns three real rows in a
 * plausible order that are not the three best. `where` DOES push down — it narrows documents
 * rather than reordering them, so the engine can apply it and the ranking is unaffected.
 */
export class SearchQueryable<TEntity extends {}, TShape = Scored<InferType<TEntity>>> {

    private readonly filters: { selector: any; params?: any }[] = [];
    private readonly sorts: { selector: GenericFunction<any, any>; descending: boolean }[] = [];
    private mapper: GenericFunction<any, any> | null = null;
    private skipCount = 0;
    private takeCount: number | null = null;

    constructor(
        private readonly dependencies: CollectionDependencies<TEntity>,
        private readonly registration: FullTextSearchRegistration,
        private readonly changeTrackingType: ChangeTrackingType,
        private readonly terms: string[],
        private readonly fields: string[]
    ) { }

    private static clone<TEntity extends {}, TShape>(source: SearchQueryable<TEntity, any>) {
        const next = new SearchQueryable<TEntity, TShape>(
            source.dependencies, source.registration, source.changeTrackingType, source.terms, source.fields
        );

        next.filters.push(...source.filters);
        next.sorts.push(...source.sorts);
        next.mapper = source.mapper;
        next.skipCount = source.skipCount;
        next.takeCount = source.takeCount;

        return next;
    }

    /** Narrows which documents can match. Pushed down to the backend like any other filter. */
    where(expression: Filter<TShape>): SearchQueryable<TEntity, TShape>;
    where<P extends {}>(selector: ParamsFilter<TShape, P>, params: P): SearchQueryable<TEntity, TShape>;
    where<P extends {} = never>(selector: ParamsFilter<TShape, P> | Filter<TShape>, params?: P) {
        const next = SearchQueryable.clone<TEntity, TShape>(this);
        next.filters.push({ selector, params });
        return next;
    }

    /** Replaces the default rank ordering. Sorting by `x.score` is the default, spelled out. */
    sort(selector: GenericFunction<TShape, any>) {
        const next = SearchQueryable.clone<TEntity, TShape>(this);
        next.sorts.push({ selector, descending: false });
        return next;
    }

    sortDescending(selector: GenericFunction<TShape, any>) {
        const next = SearchQueryable.clone<TEntity, TShape>(this);
        next.sorts.push({ selector, descending: true });
        return next;
    }

    skip(amount: number) {
        const next = SearchQueryable.clone<TEntity, TShape>(this);
        next.skipCount = amount;
        return next;
    }

    take(amount: number) {
        const next = SearchQueryable.clone<TEntity, TShape>(this);
        next.takeCount = amount;
        return next;
    }

    /** Projects the result. This is how `score` is dropped when it is not wanted. */
    map<R>(expression: GenericFunction<TShape, R>) {
        const next = SearchQueryable.clone<TEntity, R>(this);
        next.mapper = expression;
        return next;
    }

    /** Documents ranked by relevance, each carrying a readonly `score`. */
    async toArrayAsync(): Promise<TShape[]> {
        // No tokens is no query. An empty string, or one made entirely of stop words, matches
        // nothing rather than everything.
        if (this.terms.length === 0) {
            return [];
        }

        const ranked = await this.rank();

        if (ranked.length === 0) {
            return [];
        }

        const scores = new Map(ranked.map(hit => [String(hit.sourceId), hit.score]));
        const documents = await this.readDocuments(ranked.map(hit => hit.sourceId));

        const keyOf = (document: UnknownRecord) => String(document[this.registration.sourceKeyColumn]);

        // A document the filters excluded — or one soft-delete scoped away — simply is not here.
        let rows: any[] = documents.map(document => {
            const score = scores.get(keyOf(document)) ?? 0;

            // Immutable collections freeze their read results. Search results are projections
            // (the score is query metadata, never tracked), so clone a frozen/non-extensible row
            // before attaching that metadata rather than throwing in Object.defineProperty.
            const scored = Object.isExtensible(document) ? document : { ...document };

            // Non-enumerable so `score` does not survive a structured clone, a JSON round trip
            // or an equality check against a stored row. It is a fact about this result, not a
            // property of the entity.
            Object.defineProperty(scored, "score", { value: score, enumerable: false, configurable: true });

            return scored;
        });

        rows = this.order(rows, ranked);

        if (this.skipCount > 0) {
            rows = rows.slice(this.skipCount);
        }

        if (this.takeCount != null) {
            rows = rows.slice(0, this.takeCount);
        }

        return (this.mapper == null ? rows : rows.map(row => this.mapper!(row))) as TShape[];
    }

    async firstOrUndefinedAsync(): Promise<TShape | undefined> {
        const [first] = await this.take(1).toArrayAsync();

        return first;
    }

    async countAsync(): Promise<number> {
        return (await this.toArrayAsync()).length;
    }

    /** Rank order unless the caller replaced it, in which case theirs wins outright. */
    private order(rows: any[], ranked: { sourceId: string | number; score: number }[]) {

        if (this.sorts.length === 0) {
            const position = new Map(ranked.map((hit, index) => [String(hit.sourceId), index]));

            return rows.sort((left, right) =>
                (position.get(String(left[this.registration.sourceKeyColumn])) ?? 0)
                - (position.get(String(right[this.registration.sourceKeyColumn])) ?? 0));
        }

        return rows.sort((left, right) => {
            for (const { selector, descending } of this.sorts) {
                const a = selector(left);
                const b = selector(right);

                if (a === b) {
                    continue;
                }

                return (a > b ? 1 : -1) * (descending ? -1 : 1);
            }

            return 0;
        });
    }

    /**
     * Index rows for the query's terms, reduced to one scored document each.
     *
     * The lookup itself is an ordinary `includes` filter, so every backend narrows it through
     * its normal query path without knowing these rows are a search index. This is the only
     * sense in which search "defers to the database".
     */
    private async rank() {
        const rows = await this.readIndex();
        const documents = new Map<string, { sourceId: string | number; score: number; matched: Set<string> }>();

        for (const row of rows) {
            const sourceId = row.sourceId as string | number;
            const id = String(sourceId);
            const found = documents.get(id) ?? { sourceId, score: 0, matched: new Set<string>() };

            found.score += Number(row.frequency ?? 0);
            found.matched.add(String(row.term));
            documents.set(id, found);
        }

        const required = this.terms.length;

        return [...documents.values()]
            // `"all"`: every term of the query is present in at least one searched field.
            .filter(hit => this.match === "any" || hit.matched.size === required)
            // Score descending, then source key ascending. A total order, so two runs over the
            // same corpus never disagree — numeric for number keys, code-unit for strings.
            .sort((left, right) => {

                if (left.score !== right.score) {
                    return right.score - left.score;
                }

                if (typeof left.sourceId === "number" && typeof right.sourceId === "number") {
                    return left.sourceId - right.sourceId;
                }

                return String(left.sourceId) < String(right.sourceId) ? -1 : 1;
            });
    }

    private match: "all" | "any" = "all";

    /** Set by `search()`; kept off the constructor so the overloads stay readable. */
    withMatch(match: "all" | "any") {
        this.match = match;
        return this;
    }

    private readIndex() {
        const terms = this.terms;
        const fields = this.fields;

        // `documentType` is in every filter because PouchDB and browser-storage keep all
        // collections in one physical store — without it the source documents come back as
        // index rows. Backends with real tables see a column that never varies.
        const documentType = this.registration.indexSchema.collectionName;

        return this.queryRaw(this.registration.indexSchema, fields.length === 0
            ? {
                selector: ([row, p]: [any, any]) => row.documentType === p.documentType && p.terms.includes(row.term),
                params: { terms, documentType }
            }
            : {
                selector: ([row, p]: [any, any]) => row.documentType === p.documentType && p.terms.includes(row.term) && p.fields.includes(row.field),
                params: { terms, fields, documentType }
            });
    }

    /**
     * The matched documents, read through the collection's own read path.
     *
     * Through the collection rather than the raw table on purpose: soft-delete scopes and
     * `.scope()` filters apply, so a soft-deleted document can sit in the index and still not
     * appear in a result. That is the correct behaviour, and it is why the index is allowed to
     * hold rows for documents a query will never return.
     */
    private async readDocuments(sourceIds: (string | number)[]) {
        const key = this.registration.sourceKeyColumn;
        const request = new RequestContext<TEntity>(this.changeTrackingType);

        const property = this.dependencies.schema.getProperty(key);
        const filter = ([entity, p]: [any, any]) => p.ids.includes(property?.getValue(entity));
        const expression = property == null
            ? undefined
            : new ComparatorExpression({
                comparator: "includes",
                negated: false,
                strict: true,
                left: new ValueExpression({ value: sourceIds }),
                right: new PropertyExpression({ property }),
            });

        // The key column is schema metadata, not source text in a user lambda. Add the ordinary
        // `IN` filter directly so the expression parser never has to understand dynamic bracket
        // access (`entity[key]`), which it intentionally rejects.
        request.queryOptions.add("filter", {
            filter,
            expression: expression ?? Expression.NOT_PARSABLE,
            params: { ids: sourceIds },
        });

        let queryable = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        for (const filter of this.filters) {
            queryable = filter.params == null
                ? queryable.where(filter.selector)
                : queryable.where(filter.selector, filter.params);
        }

        return await queryable.toArrayAsync() as unknown as UnknownRecord[];
    }

    /** A filtered read straight from the plugin, for the index collection nobody declared. */
    private queryRaw(schema: CompiledSchema<any>, filter: { selector: any; params: any }) {
        const options = new QueryOptionsCollection<any>();

        // A real expression, not just the function: that is what lets a backend push the
        // lookup down as an ordinary `IN` rather than reading the whole index.
        options.add("filter", {
            filter: filter.selector,
            expression: toExpression(schema, filter.selector, filter.params),
            params: filter.params
        });

        return new Promise<UnknownRecord[]>((resolve, reject) => {
            (this.dependencies.plugin as IDbPlugin).query({
                operation: new Query<any, any>(options as any, schema),
                schemas: this.dependencies.schemas as SchemaCollection,
                id: uuid(8),
                source: "Collection",
                action: "query"
            }, (result) => {

                if (result.ok === Result.ERROR) {
                    reject(result.error);
                    return;
                }

                resolve((result.data.value ?? []) as UnknownRecord[]);
            });
        });
    }
}

/** Builds the queryable for one `search()` call, resolving selectors and tokenising terms. */
export const createSearch = <TEntity extends {}>(
    dependencies: CollectionDependencies<TEntity>,
    registration: FullTextSearchRegistration,
    changeTrackingType: ChangeTrackingType,
    args: unknown[]
) => {
    const [first] = args;
    const usesSelectors = typeof first === "function" || Array.isArray(first);

    const selectors = usesSelectors ? (Array.isArray(first) ? first : [first]) as GenericFunction<any, unknown>[] : [];
    const text = (usesSelectors ? args[1] : args[0]) as string;
    const options = (usesSelectors ? args[2] : args[1]) as SearchOptions | undefined;

    const fields = selectors.map(selector => {
        const name = propertyNameFrom(selector);

        if (registration.fields.some(field => field.name === name) === false) {
            // Named a property that is not indexed — searching it would return nothing, which
            // reads as "no results" rather than as the mistake it is.
            throw new Error(
                `search() was scoped to '${name}', which is not searchable on ` +
                `'${registration.sourceSchema.collectionName}'.  Mark it with .searchable().`
            );
        }

        return name;
    });

    // The SAME tokenizer the documents went through, which is what makes matching set
    // membership. Deduplicated: a term repeated in the query is still one requirement.
    const terms = [...new Set(tokenize(text, registration.options))];

    return new SearchQueryable<TEntity>(dependencies, registration, changeTrackingType, terms, fields)
        .withMatch(options?.match ?? "all");
};
