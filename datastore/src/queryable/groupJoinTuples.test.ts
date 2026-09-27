import { describe, expect, it } from "@jest/globals";
import { JoinTuple } from "@routier/core/plugins";
import { UnknownRecord } from "@routier/core/utilities";
import { groupJoinTuples } from "./groupJoinTuples";

const keyOf = (outer: UnknownRecord) => String(outer.id);

describe("groupJoinTuples", () => {

    it("returns no groups for no tuples", () => {
        expect(groupJoinTuples([], keyOf)).toEqual([]);
    });

    it("collects every inner row of one outer row into a single group", () => {
        const alpha = { id: "a" };
        const tuples: JoinTuple[] = [[alpha, { id: 1 }], [alpha, { id: 2 }]];

        expect(groupJoinTuples(tuples, keyOf)).toEqual([[alpha, [{ id: 1 }, { id: 2 }]]]);
    });

    it("gives an outer row with no match an empty array", () => {
        const tuples: JoinTuple[] = [[{ id: "a" }, undefined]];

        expect(groupJoinTuples(tuples, keyOf)).toEqual([[{ id: "a" }, []]]);
    });

    it("keeps the first outer instance when the same key arrives as separate objects", () => {
        const first = { id: "a", copy: 1 };
        const tuples: JoinTuple[] = [[first, { id: 1 }], [{ id: "a", copy: 2 }, { id: 2 }]];

        const [[outer, inner]] = groupJoinTuples(tuples, keyOf);

        expect(outer).toBe(first);
        expect(inner).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("orders groups by the first appearance of each outer key", () => {
        const tuples: JoinTuple[] = [
            [{ id: "b" }, { id: 1 }],
            [{ id: "a" }, undefined],
            [{ id: "b" }, { id: 2 }]
        ];

        expect(groupJoinTuples(tuples, keyOf).map(([outer]) => outer.id)).toEqual(["b", "a"]);
    });

    it("groups by the key function rather than by object identity", () => {
        const tuples: JoinTuple[] = [[{ id: 1 }, { id: 10 }], [{ id: "1" }, { id: 11 }]];

        expect(groupJoinTuples(tuples, keyOf)).toHaveLength(1);
    });
});
