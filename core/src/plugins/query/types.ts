import { Expression, Filter, ParamsFilter } from "../../expressions";
import { PropertyInfo } from "../../schema";
import { GenericFunction } from "../../types";

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

export type QueryOption<T, K extends QueryOptionName> = {
    name: QueryOptionName;
    value: QueryOptionValueMap<T>[K],
    target: QueryOptionExecutionTarget;
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