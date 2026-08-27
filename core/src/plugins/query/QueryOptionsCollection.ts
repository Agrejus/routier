import { isPropertyExpression } from "../../assertions";
import { forEach } from "../../expressions/utils";
import { MemoryExecutionReason, QueryOption, QueryOptionName, QueryOptionExecutionTarget, QueryOptionValueMap } from "./types";

export type QueryCollectionItem<T, K extends QueryOptionName> = { index: number, option: QueryOption<T, K> };

export class QueryOptionsCollection<T> {

    private options: Map<QueryOptionName, QueryCollectionItem<any, any>[]> = new Map<QueryOptionName, QueryCollectionItem<any, any>[]>();
    private nextExecutionTarget: QueryOptionExecutionTarget = "database";
    private nextExecutionReason: MemoryExecutionReason | null = null;
    private nextIndex: number = 0;
    private enumeratedItems: QueryCollectionItem<any, any>[] = [];
    private dirty: boolean = true;

    /** Cuts over to memory execution, keeping the first cause. See `MemoryExecutionReason`. */
    private cutOverToMemory(reason: MemoryExecutionReason) {
        this.nextExecutionTarget = "memory";

        if (this.nextExecutionReason == null) {
            this.nextExecutionReason = reason;
        }
    }

    get items() {
        return this.options;
    }

    get isEmpty() {
        return this.items.size === 0;
    }

    static EMPTY<R>() {
        return new QueryOptionsCollection<R>();
    }

    static isEmpty<T>(options: QueryOptionsCollection<T>) {
        return options.isEmpty;
    }

    add<K extends QueryOptionName>(name: K, value: QueryOption<T, K>["value"]) {

        if (name === "map") {
            const mapValue = value as QueryOptionValueMap<T>["map"];

            // Evaluate the map value to see if we are renaming properties, 
            // if we are we need to perform everything after in memory
            if (mapValue.fields.some(x => x.isRename === true) || mapValue.fields.some(x => x.property?.isUnmapped === true)) {
                // Cut over to memory execution since we are renaming a property with .map
                // We do not want to figure out how the new name flows through the entire query
                this.cutOverToMemory("map-rename");
            }
        }

        if (name === "filter") {
            // Need to check for unmapped and renamed properties
            const filterValue = value as QueryOptionValueMap<T>["filter"];

            // A tautology (`x => true`) filters nothing — skip it entirely so
            // plugins never see it
            if (filterValue.expression.type === "empty") {
                return;
            }

            if (filterValue.expression.type === "not-parsable") {
                this.cutOverToMemory("not-parsable");
            } else {
                forEach(filterValue.expression, (expression) => {

                    if (isPropertyExpression(expression) && expression.property.isUnmapped) {
                        // Cut over to memory execution, unmapped properties are not in the database and
                        // cannot be queried
                        this.cutOverToMemory("unmapped-property");
                        return false;
                    }

                    if (isPropertyExpression(expression) && expression.property.hasRenamedSegments) {
                        // Cut over to memory execution: the plugin stores data under the
                        // `from` (storage) names, but filter selectors reference the
                        // in-memory names.  Memory execution runs after deserialization,
                        // where the in-memory names exist
                        this.cutOverToMemory("renamed-property");
                        return false;
                    }

                    return true;
                });
            }
        }

        if (name === "sort") {
            const sortValue = value as QueryOptionValueMap<T>["sort"];

            // Same rule as filters: sort selectors reference in-memory names, which
            // only exist after deserialization when the property is renamed or unmapped
            if (sortValue.property != null && sortValue.property.isUnmapped) {
                this.cutOverToMemory("unmapped-property");
            } else if (sortValue.property != null && sortValue.property.hasRenamedSegments) {
                this.cutOverToMemory("renamed-property");
            }
        }

        if (name === "nearest") {
            const nearestValue = value as QueryOptionValueMap<T>["nearest"];

            // Same rule as sort, and for the same reason: the plugin stores the vector under
            // the `from` name, and an unmapped property is not stored at all. Both are only
            // readable after deserialization, which is where memory execution runs.
            //
            // This is also what lets every translator's in-memory fallback read the column by
            // its resolved name — anything whose storage name differs never reaches them.
            if (nearestValue.property != null && nearestValue.property.isUnmapped) {
                this.cutOverToMemory("unmapped-property");
            } else if (nearestValue.property != null && nearestValue.property.hasRenamedSegments) {
                this.cutOverToMemory("renamed-property");
            }
        }

        if (name === "join") {
            const joinValue = value as QueryOptionValueMap<T>["join"];

            // A join whose two sides live on different plugins cannot be sent to EITHER of
            // them — neither can read the other's rows — so the option itself belongs to the
            // memory half, where the datastore interprets it.
            //
            // Set BEFORE the item is created, unlike `nearest`'s ratchet below, because this
            // moves the join option itself rather than everything after it.
            if (joinValue.crossPlugin === true) {
                this.cutOverToMemory("cross-plugin-join");
            }
        }

        // `executed` is the plan, not a record: nothing has run when an option is added. Every
        // consumer reads it after the plugin returned, so the optimistic window is never observed.
        const item: QueryCollectionItem<T, K> = {
            index: this.nextIndex,
            option: this.nextExecutionTarget === "database"
                ? { name, value, target: "database", reason: "executed" }
                : { name, value, target: "memory", reason: this.nextExecutionReason ?? "not-parsable" }
        }

        this.nextIndex++;
        this.dirty = true;

        const found = this.options.get(name);

        this.options.set(name, [...found ?? [], item]);

        if (name === "nearest") {
            // Everything AFTER a similarity search runs in memory, whatever the backend.
            //
            // Whether the search was pushed down is a fact about the plugin, which this
            // collection cannot see — so a later option is only safe if it runs after the
            // scoring definitely happened, and in memory is the only place that is true of.
            //
            // The failure this prevents is silent. `.nearest(x => x.embedding, v, 10).take(3)`
            // sends `LIMIT 3` to a backend that ignored the ordering, so three arbitrary rows
            // come back and get scored — three real rows, in a plausible order, and not the
            // three nearest. Nothing errors.
            //
            // A plugin that DID push the search down loses nothing but the chance to also
            // push down what follows it, which is a limit over ten rows.
            this.cutOverToMemory("after-nearest");
        }

        if (name === "join") {
            // Everything AFTER a join runs in memory, for the same reason as `nearest`: this
            // collection cannot see HOW the plugin executed the join, and the rows it produced
            // are TUPLES rather than entities of the root schema.
            //
            // A `take` sent to a backend that hash-joined in its translator would limit the
            // OUTER rows read, not the pairs produced — a plausible-looking result with the
            // wrong number of rows in it. Conjuncts that can safely run earlier are split off
            // by the query builder BEFORE dispatch, which is the only exception.
            this.cutOverToMemory("after-join");
        }
    }

    /**
     * Splits the collection around the FIRST occurrence of `name`, preserving order.
     *
     * For a join: the options recorded before it operate on entity rows, the option itself
     * produces tuples, and the ones after it operate on tuples. Three different shapes, so the
     * caller has to run them in three steps rather than one pass.
     */
    splitAt<K extends QueryOptionName>(name: K): { before: QueryOptionsCollection<T>, at: QueryOption<T, K> | null, after: QueryOptionsCollection<T> } {
        this.resolveEnumeration();

        const sortedItems = this.enumeratedItems.toSorted((a, b) => a.index - b.index);
        const before = new QueryOptionsCollection<T>();
        const after = new QueryOptionsCollection<T>();
        let at: QueryOption<T, K> | null = null;

        for (let i = 0, length = sortedItems.length; i < length; i++) {
            const { option } = sortedItems[i];

            if (at == null && option.name === name) {
                at = option as QueryOption<T, K>;
                continue;
            }

            const destination = at == null ? before : after;
            destination.adopt(sortedItems[i]);
        }

        return { before, at, after };
    }

    /**
     * Captures the collection's current state and returns a function that restores it.
     *
     * Terminal queryable operations (count, first, aggregates, …) record their option on
     * the shared collection before executing. Without restoring, a re-executed terminal —
     * the whole point of a subscribed queryable — stacks its option a second time and
     * runs it over the first execution's scalar result.
     */
    snapshot(): () => void {
        const options = new Map([...this.options.entries()].map(([key, items]): [QueryOptionName, QueryCollectionItem<any, any>[]] => [key, [...items]]));
        const nextExecutionTarget = this.nextExecutionTarget;
        const nextExecutionReason = this.nextExecutionReason;
        const nextIndex = this.nextIndex;

        return () => {
            this.options = new Map(options);
            this.nextExecutionTarget = nextExecutionTarget;
            this.nextExecutionReason = nextExecutionReason;
            this.nextIndex = nextIndex;
            this.enumeratedItems = [];
            // Clearing the list is not enough now that staleness is a flag rather than a count:
            // without this, `resolveEnumeration` believes the empty list is current and every read
            // of the collection sees no options at all.
            this.dirty = true;
        };
    }

    /** Takes an item as it stands — same object, same index, same target and reason. */
    private adopt(item: QueryCollectionItem<any, any>) {
        const found = this.options.get(item.option.name);

        this.options.set(item.option.name, [...found ?? [], item]);
        this.nextIndex = Math.max(this.nextIndex, item.index + 1);
        this.dirty = true;
    }

    /**
     * A plugin reporting that its engine cannot express one option.
     *
     * The plugin names ONE. Core marks the rest of the database phase `not-reached`, because the
     * database has to stop there — a window applied in front of a filter that was not applied
     * returns the wrong rows. Passing the cascade through core is what makes it impossible for a
     * plugin to mark a non-contiguous cut.
     *
     * The option is not moved to the memory arm. It stays where it was planned, which is what keeps
     * a redirect distinguishable from something core sent to memory in the first place.
     */
    reportMissingCapability(item: QueryCollectionItem<any, any>) {
        this.resolveEnumeration();

        for (const candidate of this.enumeratedItems) {
            if (candidate.option.target !== "database" || candidate.index < item.index) {
                continue;
            }

            candidate.option.reason = candidate.index === item.index ? "missing-capability" : "not-reached";
        }
    }

    /**
     * Forgets what any previous dispatch reported.
     *
     * Capability is answered per dispatch, so a report is only an answer for the execution that
     * produced it. The items are shared with any snapshot, so a report mutated in place otherwise
     * survives a restore and a second terminal on the same queryable replays options the plugin
     * did run — a `skip` applied twice, over rows already windowed.
     */
    forgetReports() {
        this.resolveEnumeration();

        for (const item of this.enumeratedItems) {
            if (item.option.target === "database") {
                item.option.reason = "executed";
            }
        }
    }

    /** The options the database did not run, in the order they were written. */
    notExecuted(): QueryCollectionItem<any, any>[] {
        this.resolveEnumeration();

        return this.enumeratedItems
            .filter(item => item.option.target === "database" && item.option.reason !== "executed")
            .toSorted((a, b) => a.index - b.index);
    }

    split(): { memory: QueryOptionsCollection<T>, database: QueryOptionsCollection<T> } {
        this.resolveEnumeration();

        const sortedItems = this.enumeratedItems.toSorted((a, b) => a.index - b.index);
        const memoryQueryOptionsCollection = new QueryOptionsCollection<T>();
        const databaseQueryOptionsCollection = new QueryOptionsCollection<T>();

        for (let i = 0, length = sortedItems.length; i < length; i++) {
            const sortedItem = sortedItems[i];
            const half = sortedItem.option.target === "database"
                ? databaseQueryOptionsCollection
                : memoryQueryOptionsCollection;

            // The ITEM, not its name and value. Re-adding would re-derive target and reason from a
            // fresh cascade, and a memory option re-added alone comes back out as `database` with no
            // reason at all. Sharing it also means a plugin's report on the database half is the
            // same object the explanation reads.
            half.adopt(sortedItem);
        }

        return {
            memory: memoryQueryOptionsCollection,
            database: databaseQueryOptionsCollection
        }
    }

    hasTransformations(): boolean {
        const transformationOptions: QueryOptionName[] = ["map", "group", "min", "max", "count", "sum"];
        return transformationOptions.some((name) => this.options.has(name));
    }

    has<K extends QueryOptionName>(name: K): boolean {
        return this.options.has(name);
    }

    get<K extends QueryOptionName>(name: K): QueryCollectionItem<T, K>[] {
        return this.options.get(name) ?? [] as QueryCollectionItem<T, K>[];
    }

    getLast<K extends QueryOptionName>(name: K): QueryOption<T, K> | null {
        this.resolveEnumeration();

        for (let i = this.enumeratedItems.length - 1; i >= 0; i--) {
            const item = this.enumeratedItems[i];

            if (item.option.name === name) {
                return item.option;
            }
        }

        return null
    }

    getValues<K extends QueryOptionName>(name: K): QueryCollectionItem<T, K>["option"]["value"][] | undefined {

        const found = this.options.get(name);

        if (found == null) {
            return [];
        }

        return found.map(w => w.option.value) as QueryCollectionItem<T, K>["option"]["value"][];
    }

    private getEnumeration() {
        return [...this.options.values()].flat().toSorted((a, b) => a.index - b.index);
    }

    private resolveEnumeration() {
        // A flag, not a count: adopting leaves gaps in the indexes, so `length !== nextIndex` is
        // true forever on a half and the enumeration rebuilds on every read.
        if (this.dirty === true) {
            this.enumeratedItems = this.getEnumeration();
            this.dirty = false;
        }
    }

    forEach(iterator: (item: QueryCollectionItem<T, any>["option"]) => void) {
        this.resolveEnumeration();

        for (let i = 0, length = this.enumeratedItems.length; i < length; i++) {
            iterator(this.enumeratedItems[i].option);
        }
    }
}