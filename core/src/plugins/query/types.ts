export enum QueryOrdering {
    Descending = "desc",
    Ascending = "asc"
}

export type QueryOptionTarget = "database" | "memory";
export type QueryOptionName = "skip" | "take" | "sort" | "min" | "max"
    | "count" | "sum" | "distinct" | "fields" | "map" | "filters";
export type QueryOption<T> = {
    name: QueryOptionName;
    value: T,
    target: QueryOptionTarget;
}