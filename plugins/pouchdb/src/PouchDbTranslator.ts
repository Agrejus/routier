import { assertIsArray, CompiledSchema, Filter, InferType, IQuery, JsonTranslator, ParamsFilter, QueryCollectionItem, QueryOption } from "routier-core";

export class PouchDbTranslator<TEntity extends {}, TShape extends unknown = TEntity> extends JsonTranslator<TEntity, TShape> {

    private schema: CompiledSchema<TEntity>;
    private cachedMatches: ((item: unknown) => boolean) | null = null;

    constructor(query: IQuery<TEntity>, schema: CompiledSchema<TEntity>) {
        super(query);
        this.schema = schema;
    }

    matches(item: unknown) {
        // Get or build cached filter chain
        const filterChain = this.resolveFilterChain();

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
        const databaseFilters = filters.filter(x => x.option.target === "database");

        this.cachedMatches = this.buildFilterChain(databaseFilters, 0);

        return this.cachedMatches;
    }

    private buildFilterChain(filters: QueryCollectionItem<TEntity, "filter">[], index: number): (item: unknown) => boolean {
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

    private evaluateFilter(filter: QueryOption<TEntity, "filter">): (item: unknown) => boolean {
        if (filter.value.params == null) {
            const selector = filter.value.filter as Filter<unknown>;
            return (item: unknown) => selector(item) !== false;
        }

        const selector = filter.value.filter as ParamsFilter<unknown, {}>;
        const params = filter.value.params;
        return (item: unknown) => selector([item, params]) !== false;
    }

    override translate(data: unknown): TShape {
        assertIsArray(data);

        // PouchDB converts a Date to a string when it is saved, we need to convert it back when it's selected
        const deserializedData = data.map(x => this.schema.serialize(x as InferType<TEntity>))

        return super.translate(deserializedData);
    }

}