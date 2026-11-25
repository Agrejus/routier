import { describe, expect, it } from "@jest/globals";
import { Expression } from "../../expressions/types";
import { QueryOption, QueryOrdering } from "../query/types";
import { compareBySortKeys, nextSortKeys, sortKeysEndingWith } from "./sortKeys";

type Row = { group: string | null; rank: number };

const sortBy = (selector: (row: Row) => string | number | null, direction: QueryOrdering): QueryOption<Row, "sort"> => ({
    name: "sort",
    value: { selector, direction, propertyName: "p" },
    target: "database",
    reason: "executed",
});

const byGroup = sortBy(row => row.group, QueryOrdering.Ascending);
const byRankDescending = sortBy(row => row.rank, QueryOrdering.Descending);

const filter: QueryOption<Row, "filter"> = {
    name: "filter",
    value: { filter: () => true, expression: Expression.NOT_PARSABLE, params: undefined },
    target: "database",
    reason: "executed",
};

const take: QueryOption<Row, "take"> = { name: "take", value: 1, target: "database", reason: "executed" };

const order = (rows: Row[], keys: QueryOption<Row, "sort">[]) => [...rows].sort(compareBySortKeys(keys));

describe("compareBySortKeys", () => {
    const rows: Row[] = [
        { group: "b", rank: 1 },
        { group: "a", rank: 2 },
        { group: "b", rank: 3 },
        { group: "a", rank: 9 },
    ];

    it("orders by the first key, then by the next one where the first ties", () => {
        expect(order(rows, [byGroup, byRankDescending])).toEqual([
            { group: "a", rank: 9 },
            { group: "a", rank: 2 },
            { group: "b", rank: 3 },
            { group: "b", rank: 1 },
        ]);
    });

    it("orders by one key", () => {
        expect(order(rows, [byRankDescending]).map(row => row.rank)).toEqual([9, 3, 2, 1]);
    });

    it("keeps rows that tie on every key in their order", () => {
        expect(order(rows, [byGroup]).map(row => row.rank)).toEqual([2, 9, 1, 3]);
    });

    it("keeps the order when there are no keys", () => {
        expect(order(rows, [])).toEqual(rows);
    });

    it("puts null first ascending and last descending", () => {
        const withNull: Row[] = [{ group: "a", rank: 1 }, { group: null, rank: 2 }];
        const descending = sortBy(row => row.group, QueryOrdering.Descending);

        expect(order(withNull, [byGroup]).map(row => row.group)).toEqual([null, "a"]);
        expect(order(withNull, [descending]).map(row => row.group)).toEqual(["a", null]);
    });

    it("compares null against a value from either side", () => {
        const compare = compareBySortKeys([byGroup]);

        expect(compare({ group: null, rank: 0 }, { group: "a", rank: 0 })).toBe(-1);
        expect(compare({ group: "a", rank: 0 }, { group: null, rank: 0 })).toBe(1);
        expect(compare({ group: null, rank: 0 }, { group: null, rank: 0 })).toBe(0);
    });

    it("returns 1 for a greater value and -1 for a lesser one", () => {
        const compare = compareBySortKeys([byGroup]);

        expect(compare({ group: "b", rank: 0 }, { group: "a", rank: 0 })).toBe(1);
        expect(compare({ group: "a", rank: 0 }, { group: "b", rank: 0 })).toBe(-1);
    });
});

describe("nextSortKeys", () => {
    it("adds a sort to the keys", () => {
        expect(nextSortKeys([byGroup], byRankDescending)).toEqual([byGroup, byRankDescending]);
    });

    it("keeps the keys across a filter", () => {
        const keys = [byGroup];
        const next = nextSortKeys(keys, filter);

        expect(next).toEqual([byGroup]);
        expect(next).not.toBe(keys);
    });

    it("starts over after any other option", () => {
        expect(nextSortKeys([byGroup], take)).toEqual([]);
    });
});

describe("sortKeysEndingWith", () => {
    it("uses the keys when they end with the option", () => {
        expect(sortKeysEndingWith([byGroup, byRankDescending], byRankDescending)).toEqual([byGroup, byRankDescending]);
    });

    it("uses the option alone when the keys do not end with it", () => {
        expect(sortKeysEndingWith([byGroup], byRankDescending)).toEqual([byRankDescending]);
        expect(sortKeysEndingWith([], byRankDescending)).toEqual([byRankDescending]);
    });
});
