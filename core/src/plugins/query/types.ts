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
    sort: { selector: GenericFunction<T, T[keyof T]>, direction: QueryOrdering, propertyName: string };
    map: { selector: GenericFunction<T, any>, fields: QueryField[] };
    filter: { params?: {}, filter: ParamsFilter<T, {}> | Filter<T>, expression: Expression };
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