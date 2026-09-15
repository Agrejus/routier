import { isComparatorExpression, isPropertyExpression, isValueExpression } from "../../assertions";
import { ComparatorExpression, Expression } from "../../expressions/types";
import { forEach } from "../../expressions/utils";
import { SchemaTypes } from "../../schema/types";
import { logger } from "../../utilities";
import { DatabaseExecutionReason, MemoryExecutionReason, QueryOption, QueryOptionName, QueryOptionExecutionTarget, QueryOptionValueMap } from "./types";

export type QueryCollectionItem<T, K extends QueryOptionName> = { index: number, option: QueryOption<T, K> };

/** What a schema type is called in JavaScript, where one exists. A value of any other type cannot equal it. */
const JAVASCRIPT_TYPE_OF: Partial<Record<SchemaTypes, string>> = {
    [SchemaTypes.Number]: "number",
    [SchemaTypes.String]: "string",
    [SchemaTypes.Boolean]: "boolean",
    [SchemaTypes.Date]: "object",
};

const mismatchedSide = (property: Expression | undefined, value: Expression | undefined) => {
    if (property == null || value == null || !isPropertyExpression(property) || !isValueExpression(value)) {
        return null;
    }

    const expected = JAVASCRIPT_TYPE_OF[property.property.type];

    if (expected == null || value.value == null || typeof value.value === expected) {
        return null;
    }

    return { property, value, expected };
};

/** A strict comparison whose answer is the same for every row, because the types cannot be equal. */
const comparesTypesThatCannotMatch = (expression: Expression): boolean => {
    if (!isComparatorExpression(expression) || expression.strict !== true) {
        return false;
    }

    if (expression.comparator !== "equals") {
        return false;
    }

    return mismatchedSide(expression.left, expression.right) != null
        || mismatchedSide(expression.right, expression.left) != null;
};

/** `JSON.stringify` throws on a BigInt, and this runs inside the guard that exists to catch one. */
const describeLiteral = (value: unknown): string =>
    typeof value === "string" ? `"${value}"` : String(value);

const mismatchWarning = (expression: ComparatorExpression): string => {
    const side = mismatchedSide(expression.left, expression.right)
        ?? mismatchedSide(expression.right, expression.left)!;

    const outcome = expression.negated ? "every row matches" : "no row matches";

    return `Routier: '${side.property.property.getAssignmentPath()}' is a ${side.expected}, and this filter ` +
        `compares it against ${describeLiteral(side.value.value)}, which is a ${typeof side.value.value}. ` +
        `A strict comparison between them is the same answer for every row, so ${outcome} and the filter ` +
        `runs in memory. https://routier.dev/guides/strict-comparison-types`;
};

/**
 * An item as one dispatch receives it: a new object, so a report written on it stays with that dispatch.
 *
 * A database option starts `executed` again, because a report is only an answer from the plugin that
 * made it. A memory option keeps the reason core planned it with. A join's inner options are copied the
 * same way, since a plugin can report on them too.
 */
const toDispatchItem = (item: QueryCollectionItem<any, any>): QueryCollectionItem<any, any> => {
    const option = item.option as QueryOption<any, any>;
    const value = option.name === "join"
        ? { ...option.value, innerOptions: (option.value.innerOptions as QueryOptionsCollection<any>).forDispatch() }
        : option.value;

    return {
        index: item.index,
        option: (option.target === "database"
            ? { ...option, value, reason: "executed" }
            : { ...option, value }) as QueryOption<any, any>
    };
};

export class QueryOptionsCollection<T> {

    private options: Map<QueryOptionName, QueryCollectionItem<any, any>[]> = new Map<QueryOptionName, QueryCollectionItem<any, any>[]>();
    private nextExecutionTarget: QueryOptionExecutionTarget = "database";
    private nextExecutionReason: MemoryExecutionReason | null = null;
    private nextIndex: number = 0;
    private enumeratedItems: QueryCollectionItem<any, any>[] = [];
    private dirty: boolean = true;

    /** The collection a `splitAt`/`split` half came from. A capability report belongs to it. */
    private origin: QueryOptionsCollection<T> | null = null;

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
            // Need to check for unmapped properties
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

                    // A renamed property stays with the database. Whether the backend can read a
                    // `from` name is the plugin's to know, not this collection's: the property
                    // travels with the option, and a plugin that cannot resolve it reports it
                    // back — see `reportRenamedProperties`

                    if (comparesTypesThatCannotMatch(expression)) {
                        logger.warn(mismatchWarning(expression as ComparatorExpression));
                        this.cutOverToMemory("predicate-error");
                        return false;
                    }

                    return true;
                });
            }
        }

        if (name === "sort") {
            const sortValue = value as QueryOptionValueMap<T>["sort"];

            // Same rule as filters: an unmapped property only exists after deserialization. A
            // renamed one stays with the database, for the plugin to resolve or report
            if (sortValue.property != null && sortValue.property.isUnmapped) {
                this.cutOverToMemory("unmapped-property");
            }
        }

        if (name === "nearest") {
            const nearestValue = value as QueryOptionValueMap<T>["nearest"];

            // Same rule as sort, and for the same reason: an unmapped property is not stored at
            // all, so it is only readable after deserialization, which is where memory execution
            // runs. A vector stored under a `from` name is the plugin's to resolve or report.
            if (nearestValue.property != null && nearestValue.property.isUnmapped) {
                this.cutOverToMemory("unmapped-property");
            }
        }

        if ((name === "filter" || name === "sort") && (this.options.has("skip") || this.options.has("take"))) {
            // SQL emits WHERE before LIMIT and Mongo's find() filters before skipping, so an option
            // written after a window can only see the windowed rows if it runs after it.
            this.cutOverToMemory("after-window");
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

        before.origin = this.origin ?? this;
        after.origin = this.origin ?? this;

        return { before, at, after };
    }

    /**
     * Captures the collection's current state and returns a function that restores it.
     *
     * Terminal queryable operations (count, first, aggregates, …) record their option on
     * the shared collection before executing. Without restoring, a re-executed terminal —
     * the whole point of a subscribed queryable — stacks its option a second time and
     * runs it over the first execution's scalar result.
     *
     * The item objects are shared with the snapshot. Nothing reports on them, because every
     * dispatch sends a `forDispatch` copy, so a restore brings back no reports.
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
     * Core marks the rest of the database phase `not-reached`, because the database has to stop
     * there — a window applied in front of a filter that was not applied returns the wrong rows.
     * Passing the cascade through core is what makes it impossible for a plugin to mark a
     * non-contiguous cut.
     *
     * A report names a culprit and never un-names one, so reports commute.
     *
     * The option is not moved to the memory arm. It stays where it was planned, which is what keeps
     * a redirect distinguishable from something core sent to memory in the first place.
     */
    reportMissingCapability(item: QueryCollectionItem<any, any>) {
        this.report(item, "missing-capability");
    }

    /**
     * A plugin reporting that its engine would answer one option differently from JavaScript.
     *
     * Same cascade as `reportMissingCapability`, and a separate reason because the caller can act on
     * one and not the other. See `DatabaseExecutionReason`.
     */
    reportEngineDivergence(item: QueryCollectionItem<any, any>) {
        this.report(item, "engine-divergence");
    }

    private report(item: QueryCollectionItem<any, any>, reason: DatabaseExecutionReason) {
        // A half can only see its own slice, and the database has to stop for the whole dispatch.
        if (this.origin != null) {
            this.origin.report(item, reason);
            return;
        }

        this.resolveEnumeration();

        for (const candidate of this.enumeratedItems) {
            if (candidate.option.target !== "database" || candidate.index < item.index) {
                continue;
            }

            if (candidate.index === item.index) {
                candidate.option.reason = reason;
                continue;
            }

            if (candidate.option.reason === "executed") {
                candidate.option.reason = "not-reached";
            }
        }
    }

    /**
     * A copy of the collection for one dispatch to a plugin, with nothing reported on it.
     *
     * Capability is answered per dispatch, so a report is only an answer for the execution that
     * produced it. Reports are written onto items, and the items of a queryable's collection
     * outlive any one execution: a snapshot shares them, and a subscription dispatches the same
     * query on every change. A report left on them replays options the plugin did run on the
     * next execution, such as a `skip` applied twice over rows already windowed, or hands a
     * renamed filter to memory that the engine could have run.
     *
     * Each item keeps its index, name, value and target. A half from `split`/`splitAt` is copied
     * with a copy of its origin, and its items are that copy's items, so a report on the half still
     * cascades over the whole dispatch without reaching the collection it was copied from.
     */
    forDispatch(): QueryOptionsCollection<T> {
        if (this.origin == null) {
            return this.copyForDispatch().copy;
        }

        const { copy: root, copies } = this.origin.copyForDispatch();
        const half = new QueryOptionsCollection<T>();

        this.resolveEnumeration();

        for (const item of this.enumeratedItems) {
            // An item added to the half after it was split has no counterpart in the origin
            half.adopt(copies.get(item) ?? toDispatchItem(item));
        }

        half.origin = root;

        return half;
    }

    private copyForDispatch() {
        const copy = new QueryOptionsCollection<T>();
        const copies = new Map<QueryCollectionItem<any, any>, QueryCollectionItem<any, any>>();

        this.resolveEnumeration();

        for (const item of this.enumeratedItems) {
            const copied = toDispatchItem(item);

            copies.set(item, copied);
            copy.adopt(copied);
        }

        copy.nextExecutionTarget = this.nextExecutionTarget;
        copy.nextExecutionReason = this.nextExecutionReason;
        copy.nextIndex = this.nextIndex;

        return { copy, copies };
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

        memoryQueryOptionsCollection.origin = this.origin ?? this;
        databaseQueryOptionsCollection.origin = this.origin ?? this;

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