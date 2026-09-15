import { assertIsArray } from "@routier/core/assertions";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { IQuery, JsonTranslator, QueryCollectionItem, QueryOption } from "@routier/core/plugins";
import { getStorageDateReviver, StorageDateReviver } from "@routier/core/schema";

export class PouchDbTranslator<TEntity extends {}, TShape extends unknown = TEntity> extends JsonTranslator<TEntity, TShape> {

    /**
     * PouchDB stores JSON, so a date comes back as the ISO string the datastore serialized it to.
     * The caller's lambdas compare and call Dates, so every document is revived before one runs.
     * Only the dates: keys stay under their `from` names. `null` for a schema with no dates.
     */
    private readonly reviveDates: StorageDateReviver | null;
    private cachedMatches: ((item: unknown) => boolean) | null = null;

    constructor(query: IQuery<TEntity, TShape>) {
        super(query);
        this.reviveDates = getStorageDateReviver(query.schema);
    }

    matches(item: unknown) {
        // Get or build cached filter chain
        const filterChain = this.resolveFilterChain();

        this.reviveDates?.(item as Record<string, unknown>);

        // Execute the chain (no loops, just recursive function calls)
        return filterChain(item);
    }

    private resolveFilterChain(): (item: unknown) => boolean {
        // Return cached chain if available
        if (this.cachedMatches !== null) {
            return this.cachedMatches;
        }

        // Build and cache the filter chain
        const filters = this.query.options.get("filter");
        // Not a filter the plugin reported: the datastore runs that one, after deserialization
        const databaseFilters = filters.filter(x => x.option.target === "database" && x.option.reason === "executed");

        this.cachedMatches = this.buildFilterChain(databaseFilters, 0);

        return this.cachedMatches;
    }

    private buildFilterChain(filters: QueryCollectionItem<TShape, "filter">[], index: number): (item: unknown) => boolean {
        // Base case: no more filters, return true
        if (index >= filters.length) {
            return () => true;
        }

        // Get current filter function
        const currentFilter = this.evaluateFilter(filters[index].option);

        // Build the rest of the chain
        const nextFilter = this.buildFilterChain(filters, index + 1);

        // Return a function that checks current filter and calls next
        return (item: unknown) => {
            if (!currentFilter(item)) {
                return false; // Early termination
            }
            return nextFilter(item); // Recursive call to next filter
        };
    }

    private evaluateFilter(filter: QueryOption<TShape, "filter">): (item: unknown) => boolean {
        if (filter.value.params == null) {
            const selector = filter.value.filter as Filter<unknown>;
            return (item: unknown) => selector(item) !== false;
        }

        const selector = filter.value.filter as ParamsFilter<unknown, {}>;
        const params = filter.value.params;
        return (item: unknown) => selector([item, params]) !== false;
    }

    override translate(data: unknown) {
        assertIsArray(data);

        const documents: Record<string, unknown>[] = [];

        for (let i = 0, length = data.length; i < length; i++) {
            const document = data[i] as Record<string, unknown>;

            // design docs can be included in the result, ignore them
            if (typeof document._id === "string" && document._id.startsWith("_design")) {
                continue;
            }

            // Again, whether or not the view predicate revived it: a view may hand back a copy of
            // what it emitted, and a document read without a view was never revived
            this.reviveDates?.(document);
            documents.push(document);
        }

        // Documents stay in storage shape. The datastore deserializes the rows this returns, by
        // their `from` names, and a join does the same per side.
        return super.translate(documents);
    }

}