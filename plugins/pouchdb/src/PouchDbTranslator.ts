import { assertIsArray } from "@routier/core/assertions";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { IQuery, JsonTranslator, QueryCollectionItem, QueryOption } from "@routier/core/plugins";
import { CompiledSchema, InferType } from "@routier/core/schema";

export class PouchDbTranslator<TEntity extends {}, TShape extends unknown = TEntity> extends JsonTranslator<TEntity, TShape> {

    private schema: CompiledSchema<TEntity>;
    private cachedMatches: ((item: unknown) => boolean) | null = null;

    constructor(query: IQuery<TEntity, TShape>) {
        super(query);
        this.schema = query.schema;
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

        const result: unknown[] = [];

        // Each deserialized row, to the document it was read from.
        const stored = new Map<unknown, unknown>();

        for (let i = 0, length = data.length; i < length; i++) {
            const entity: any = data[i];

            // design docs can be included in the result, ignore them
            if ("_id" in entity && typeof entity._id === "string" && entity._id.startsWith("_design")) {
                continue;
            }

            try {
                // PouchDB converts a Date to a string when it is saved, we need to convert it back when it's selected
                const row = this.schema.deserialize(entity as InferType<TEntity>);
                result.push(row);
                stored.set(row, entity);
                data[i] = null;
            } catch (e) {
                throw new Error(`Error deserializing entity from db.  Message: ${e.message}, Entity: ${JSON.stringify(entity, null, 2)}`)
            }
        }

        const translated = super.translate(result);

        // Rows that come through the options as rows go back as they are stored. The datastore
        // deserializes rows itself, reading renamed properties by their `from` names, and a join
        // does the same per side, so a row handed back already deserialized loses every renamed
        // property. A projection or aggregate is not a row and stays as the options produced it.
        if (Array.isArray(translated.value)) {
            const value = translated.value as unknown[];

            for (let i = 0, length = value.length; i < length; i++) {
                const document = stored.get(value[i]);

                if (document !== undefined) {
                    value[i] = document;
                }
            }
        }

        return translated;
    }

}