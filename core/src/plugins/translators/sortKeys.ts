import { QueryOption, QueryOptionName, QueryOrdering } from "../query/types";

type SortOption<TShape> = QueryOption<TShape, "sort">;

const comparable = <TValue>(value: TValue): TValue | number => value instanceof Date ? value.getTime() : value;

const compareValues = <TValue>(left: TValue, right: TValue): number => {
    const a = comparable(left);
    const b = comparable(right);

    if (a == null) {
        return b == null ? 0 : -1;
    }

    if (b == null) {
        return 1;
    }

    if (a < b) {
        return -1;
    }

    return a > b ? 1 : 0;
};

const isSortOption = <TShape>(option: QueryOption<TShape, QueryOptionName>): option is SortOption<TShape> => option.name === "sort";

export const compareBySortKeys = <TShape>(keys: readonly SortOption<TShape>[]) => (x: TShape, y: TShape): number => {
    for (const key of keys) {
        const result = compareValues(key.value.selector(x), key.value.selector(y));

        if (result !== 0) {
            return key.value.direction === QueryOrdering.Descending ? -result : result;
        }
    }

    return 0;
};

export const nextSortKeys = <TShape>(keys: readonly SortOption<TShape>[], option: QueryOption<TShape, QueryOptionName>): SortOption<TShape>[] => {
    if (isSortOption(option)) {
        return [...keys, option];
    }

    return option.name === "filter" ? [...keys] : [];
};

export const sortKeysEndingWith = <TShape>(keys: readonly SortOption<TShape>[], option: SortOption<TShape>): readonly SortOption<TShape>[] =>
    keys[keys.length - 1] === option ? keys : [option];
