import { ComparatorExpression, Expression, OperatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { compareBySortKeys, QueryOption, QueryOptionName, QueryOptionsCollection, QueryOrdering } from "@routier/core/plugins";
import { PropertyInfo } from "@routier/core/schema";
import { UnknownRecord } from "@routier/core/utilities";

type SortOption<T extends {}> = QueryOption<T, "sort">;
type SortValue<T extends {}> = SortOption<T>["value"];

const assertCursorCanFollow = <T extends {}>(options: QueryOptionsCollection<T>): void => {
    const notAllowedBefore: QueryOptionName[] = ["skip", "take", "map", "nearest"];
    const blocking = notAllowedBefore.find(name => options.has(name));

    if (blocking != null) {
        throw new Error(`.cursor() must come before .${blocking}().  Write it right after the sorts, then .take() the page size.`);
    }

    if (options.has("sort") === false) {
        throw new Error(`.cursor() needs a .sort() before it.  A cursor continues an order, so the query needs one.`);
    }
};

const read = <T extends {}>(property: PropertyInfo<T>, row: T) => property.getValue(row as UnknownRecord);

const sortsBy = <T extends {}>(sort: SortValue<T>, property: PropertyInfo<T>) => sort.isDirectProperty === true && sort.property === property;

const keySort = <T extends {}>(property: PropertyInfo<T>): SortValue<T> => ({
    selector: row => read(property, row),
    direction: QueryOrdering.Ascending,
    propertyName: property.id,
    property,
    isDirectProperty: true,
});

const addKeySorts = <T extends {}>(options: QueryOptionsCollection<T>, keys: readonly PropertyInfo<T>[]): void => {
    const sorts = options.getValues("sort");

    for (const key of keys) {
        if (sorts.some(sort => sortsBy(sort, key)) === false) {
            options.add("sort", keySort(key));
        }
    }
};

const assertCursorHasKeys = <T extends {}>(keys: readonly PropertyInfo<T>[], cursor: T): void => {
    const missing = keys.find(key => read(key, cursor) == null);

    if (missing != null) {
        throw new Error(`The cursor has no value for its key '${missing.id}'.  Pass a row from the previous page.`);
    }
};

const pushableProperty = <T extends {}>(sort: SortValue<T>): PropertyInfo<T> | null => {
    const property = sort.isDirectProperty === true ? sort.property : null;

    if (property == null || property.isNullable || property.isOptional || property.hasNullableParents) {
        return null;
    }

    return property;
};

const compared = <T extends {}>(sort: SortValue<T>, property: PropertyInfo<T>, value: T[keyof T]) => new ComparatorExpression({
    comparator: sort.direction === QueryOrdering.Descending ? "less-than" : "greater-than",
    negated: false,
    strict: true,
    left: new PropertyExpression({ property }),
    right: new ValueExpression({ value }),
});

const equal = <T extends {}>(property: PropertyInfo<T>, value: T[keyof T]) => new ComparatorExpression({
    comparator: "equals",
    negated: false,
    strict: true,
    left: new PropertyExpression({ property }),
    right: new ValueExpression({ value }),
});

type Bound<T extends {}> = { sort: SortValue<T>; property: PropertyInfo<T>; value: T[keyof T] };

const keyset = <T extends {}>([first, ...rest]: Bound<T>[]): Expression => {
    const past = compared(first.sort, first.property, first.value);

    if (rest.length === 0) {
        return past;
    }

    return new OperatorExpression({
        operator: "||",
        left: past,
        right: new OperatorExpression({ operator: "&&", left: equal(first.property, first.value), right: keyset(rest) }),
    });
};

const boundsOf = <T extends {}>(sorts: SortValue<T>[], cursor: T): Bound<T>[] | null => {
    const bounds: Bound<T>[] = [];

    for (const sort of sorts) {
        const property = pushableProperty(sort);

        if (property == null) {
            return null;
        }

        bounds.push({ sort, property, value: sort.selector(cursor) });
    }

    return bounds;
};

const cursorExpression = <T extends {}>(sorts: SortValue<T>[], cursor: T): Expression => {
    const bounds = boundsOf(sorts, cursor);

    if (bounds == null) {
        return Expression.notParsable("a cursor over a computed, nullable or optional sort is compared in memory");
    }

    return keyset(bounds);
};

export const addCursor = <T extends {}>(options: QueryOptionsCollection<T>, keys: readonly PropertyInfo<T>[], cursor: T | null): void => {
    assertCursorCanFollow(options);

    if (cursor == null) {
        addKeySorts(options, keys);
        return;
    }

    assertCursorHasKeys(keys, cursor);
    addKeySorts(options, keys);

    const sorts: SortOption<T>[] = options.get("sort").map(item => item.option);
    const isPast = compareBySortKeys(sorts);

    options.add("filter", {
        filter: ([row]: [T, {}]) => isPast(row, cursor) > 0,
        expression: cursorExpression(sorts.map(sort => sort.value), cursor),
        params: { after: sorts.map(sort => sort.value.selector(cursor)) },
    });
};
