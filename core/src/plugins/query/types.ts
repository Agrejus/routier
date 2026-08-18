import { Expression, Filter, ParamsFilter } from "../../expressions";
import { PropertyInfo, SchemaId } from "../../schema";
import { GenericFunction } from "../../types";
import type { JoinKeyReference, JoinKind } from "./join";
import type { QueryOptionsCollection } from "./QueryOptionsCollection";

export enum QueryOrdering {
    Descending = "desc",
    Ascending = "asc"
}

/**
 * Field mapping for a query result, including source and destination names and a getter function.
 */
export type QueryField = {
    sourceName: string,
    destinationName: string,
    isRename: boolean;
    property?: PropertyInfo<unknown>;
    getter: <T>(data: Record<string, unknown>) => T;
};

export type QueryOptionExecutionTarget = "database" | "memory";
export type QueryOptionName = keyof QueryOptionValueMap<unknown>;

/**
 * Why an option runs in memory rather than in the database.
 *
 * A code rather than a sentence, so a test can assert on it — the sentences live in
 * `MEMORY_EXECUTION_EXPLANATIONS`. Every cause is a ratchet, because `nextExecutionTarget`
 * never returns to `"database"`, so the code recorded is the FIRST cause and it stays on every
 * option after it. Reporting a later one would name a symptom of this one.
 */
export type MemoryExecutionReason =
    | "not-parsable"
    | "unmapped-property"
    | "renamed-property"
    | "map-rename"
    | "after-nearest"
    | "after-join"
    | "cross-plugin-join";

export type QueryOption<T, K extends QueryOptionName> = {
    name: QueryOptionName;
    value: QueryOptionValueMap<T>[K],
    target: QueryOptionExecutionTarget;
    /** Set only when `target` is `"memory"`. */
    reason?: MemoryExecutionReason;
}

export type QueryOptionValueMap<T extends {}> = {
    skip: number;
    take: number;
    sort: { selector: GenericFunction<T, T[keyof T]>, direction: QueryOrdering, propertyName: string, property?: PropertyInfo<T> | null };
    map: { selector: GenericFunction<T, any>, fields: QueryField[] };
    group: { selector: GenericFunction<T, any>, key: QueryField, fields: QueryField[] };
    filter: { params?: {}, filter: ParamsFilter<T, {}> | Filter<T>, expression: Expression };
    /**
     * Similarity search: an ordering plus a limit, never a filter.
     *
     * `count` is part of the option rather than a separate `take` because the two are one
     * operation to a backend that can push this down — `ORDER BY ... LIMIT n` is what makes an
     * approximate index usable, and splitting them would order every row before limiting.
     */
    nearest: { selector: GenericFunction<T, T[keyof T]>, propertyName: string, property?: PropertyInfo<T> | null, vector: number[], count: number };
    /**
     * An equi-join against a second collection, interpreted by whoever receives it.
     *
     * A first-class query option rather than a datastore side-path: a SQL backend emits a real
     * `INNER JOIN`/`LEFT JOIN`, every other backend loads the rows it needs and the shared hash
     * join runs inside the plugin, and a cross-plugin join runs in the datastore's memory half.
     * All three produce the same pairs — see `specs/joins.md`.
     *
     * Serializable by construction: property paths and a schema id, never live rows, with any
     * filter's values travelling in its params object. That is what lets the whole option be
     * forwarded to a server once expression-tree serialization lands.
     */
    join: {
        kind: JoinKind;
        /** Resolved through `event.schemas`, which already carries every schema in the store. */
        innerSchemaId: SchemaId;
        outerKey: JoinKeyReference;
        innerKey: JoinKeyReference;
        /**
         * The inner side's own filters — INCLUDING its soft-delete scope and `.scope()`
         * filters. Every interpreter must apply these: it is the only place they exist, because
         * a join bypasses the inner collection's normal read path.
         */
        innerOptions: QueryOptionsCollection<any>;
        /**
         * Whether the two sides live on DIFFERENT plugin instances, in which case no plugin can
         * receive the option and the datastore is the interpreter.
         *
         * Decided by plugin instance identity at build time, never by comparing database names —
         * two plugins over one database are still two interpreters, and one name can front two
         * databases.
         */
        crossPlugin: boolean;
        /**
         * How many distinct outer keys are still worth turning into an `IN (...)` prefilter on the
         * inner read — the datastore's `semiJoinKeyThreshold`, default 500.
         *
         * Carried in the option because the decision is made where the join executes, which is
         * usually inside a plugin, and a plugin cannot see a datastore's configuration. A number
         * serializes; a reference to the store would not.
         *
         * Cost only. Above the threshold the inner side is read under its own scopes and the hash
         * join discards the surplus — the same answer by a slower route.
         */
        semiJoinKeyThreshold: number;
    };
    min: true; // True or not set
    max: true; // True or not set
    count: true; // True or not set
    sum: true; // True or not set
    distinct: true; // True or not set
};

/**
 * Sort specification for a query.
 */
export type QuerySort = { key: string, selector: (item: unknown) => unknown, direction: "asc" | "desc" };