import { describe, it, expect } from '@jest/globals';
import { applyInnerOptions, DEFAULT_SEMI_JOIN_KEY_THRESHOLD, distinctJoinKeys, executeJoin, hashJoin, JoinKeyReference, readJoinKey, semiJoinFilter } from './join';
import { QueryOptionsCollection } from './QueryOptionsCollection';
import { Expression } from '../../expressions';
import { UnknownRecord } from '../../utilities';

const outerKey: JoinKeyReference = { propertyName: "id", property: null };
const innerKey: JoinKeyReference = { propertyName: "outerId", property: null };

const join = (kind: "inner" | "left", outerRows: UnknownRecord[], innerRows: UnknownRecord[]) =>
    hashJoin({ kind, outerRows, innerRows, outerKey, innerKey });

// The shared hash join is the one piece every interpretation of a join runs through — the
// in-plugin path, the datastore's cross-plugin path, and (once it lands) the row-splitting
// half of a native SQL join. Every rule in the semantics table of specs/joins.md is asserted
// here, against the algorithm directly, because a difference here is a difference on every
// backend at once.
describe("hash join", () => {

    it("pairs rows whose keys are equal", () => {
        const pairs = join("inner",
            [{ id: 1, name: "a" }, { id: 2, name: "b" }],
            [{ outerId: 2, tag: "x" }]
        );

        expect(pairs).toEqual([[{ id: 2, name: "b" }, { outerId: 2, tag: "x" }]]);
    });

    it("drops unmatched outer rows on an inner join", () => {
        const pairs = join("inner", [{ id: 1 }, { id: 2 }], [{ outerId: 2 }]);

        expect(pairs).toHaveLength(1);
    });

    it("keeps unmatched outer rows on a left join, paired with undefined", () => {
        const pairs = join("left", [{ id: 1 }, { id: 2 }], [{ outerId: 2 }]);

        expect(pairs).toEqual([
            [{ id: 1 }, undefined],
            [{ id: 2 }, { outerId: 2 }]
        ]);
    });

    // The inner half of an unmatched left pair is `undefined`, never an entity whose
    // properties are all null — the two mean different things to a caller checking `m == null`
    it("never fabricates an inner row", () => {
        const [[, inner]] = join("left", [{ id: 1 }], []);

        expect(inner).toBeUndefined();
    });

    it("emits every pair when both sides have duplicate keys", () => {
        const pairs = join("inner",
            [{ id: 1, side: "o1" }, { id: 1, side: "o2" }],
            [{ outerId: 1, side: "i1" }, { outerId: 1, side: "i2" }]
        );

        // The full cross product per key group: two outer rows × two inner rows
        expect(pairs).toHaveLength(4);
        expect(pairs.map(([o, i]) => `${o.side}-${(i as UnknownRecord).side}`)).toEqual([
            "o1-i1", "o1-i2", "o2-i1", "o2-i2"
        ]);
    });

    describe("null keys", () => {

        it("never match, on either side", () => {
            const pairs = join("inner",
                [{ id: null }, { id: undefined }, {}],
                [{ outerId: null }, { outerId: undefined }, {}]
            );

            expect(pairs).toEqual([]);
        });

        it("still yield the outer row on a left join", () => {
            const pairs = join("left", [{ id: null }], [{ outerId: null }]);

            expect(pairs).toEqual([[{ id: null }, undefined]]);
        });
    });

    // A Map compares keys by SameValueZero, under which NaN equals itself; the specified
    // comparison is strict ===, under which it does not. Left alone, NaN would be the single
    // value where an in-memory join and a SQL join disagree.
    it("treats NaN as unmatchable, the way === does", () => {
        const pairs = join("inner", [{ id: NaN }], [{ outerId: NaN }]);

        expect(pairs).toEqual([]);
    });

    it("does not match across types", () => {
        const pairs = join("inner", [{ id: 1 }], [{ outerId: "1" }]);

        expect(pairs).toEqual([]);
    });

    describe("empty sides", () => {

        it("yield no pairs on an inner join", () => {
            expect(join("inner", [{ id: 1 }], [])).toEqual([]);
            expect(join("inner", [], [{ outerId: 1 }])).toEqual([]);
        });

        it("yield all-left-with-undefined on a left join", () => {
            expect(join("left", [{ id: 1 }], [])).toEqual([[{ id: 1 }, undefined]]);
            expect(join("left", [], [{ outerId: 1 }])).toEqual([]);
        });
    });
});

// The prefilter narrows what the inner side READS. It must never narrow what the join RETURNS,
// which is what "cost only, never answers" means — so every rule here is about which keys are
// worth sending, not about which pairs exist.
describe("semi-join prefilter", () => {

    it("collects the distinct matchable keys", () => {
        const keys = distinctJoinKeys(
            [{ id: 1 }, { id: 1 }, { id: 2 }, { id: null }, { id: NaN }],
            outerKey
        );

        // Duplicates collapse; a null or NaN key matches nothing, so sending it would only widen
        // the inner read
        expect([...keys!]).toEqual([1, 2]);
    });

    it("gives up above the threshold rather than sending a huge list", () => {
        const rows = Array.from({ length: 11 }, (_, i) => ({ id: i }));

        expect(distinctJoinKeys(rows, outerKey, 10)).toBeNull();
        expect(distinctJoinKeys(rows, outerKey, 11)).not.toBeNull();
    });

    // An empty SET is a real answer — the inner side cannot match anything — and is not the same
    // as `null`, which means "do not prefilter".
    it("distinguishes no usable keys from too many", () => {
        expect([...distinctJoinKeys([{ id: null }], outerKey)!]).toEqual([]);
    });

    it("builds a filter that keeps exactly the rows whose key was collected", () => {
        const { filter } = semiJoinFilter(innerKey, new Set([1, 2]));
        const keep = filter as unknown as (row: UnknownRecord) => boolean;

        expect([{ outerId: 1 }, { outerId: 3 }, { outerId: null }].filter(keep)).toEqual([{ outerId: 1 }]);
    });
});

describe("readJoinKey", () => {

    it("walks a nested path by name", () => {
        expect(readJoinKey({ a: { b: { id: 7 } } }, { propertyName: "a.b.id", property: null })).toBe(7);
    });

    it("returns null rather than throwing when the path is absent", () => {
        expect(readJoinKey({}, { propertyName: "a.b.id", property: null })).toBeNull();
        expect(readJoinKey(undefined, { propertyName: "id", property: null })).toBeNull();
    });
});

// The correctness trap: a join bypasses the inner collection's read path, so the inner side's
// soft-delete scope and .scope() filters exist ONLY in innerOptions. An interpreter that skips
// them returns soft-deleted rows.
describe("inner options", () => {

    const withFilter = (filter: (row: any) => boolean, params?: {}) => {
        const options = new QueryOptionsCollection<UnknownRecord>();
        options.add("filter", { filter: filter as never, expression: Expression.NOT_PARSABLE, params });
        return options;
    };

    it("filters the inner rows", () => {
        const rows = applyInnerOptions(
            [{ id: 1, deletedAt: null }, { id: 2, deletedAt: new Date() }],
            withFilter(row => row.deletedAt == null)
        );

        expect(rows).toEqual([{ id: 1, deletedAt: null }]);
    });

    it("applies a params filter with its params", () => {
        const rows = applyInnerOptions(
            [{ kind: "a" }, { kind: "b" }],
            withFilter(([row, p]: any) => row.kind === p.kind, { kind: "b" })
        );

        expect(rows).toEqual([{ kind: "b" }]);
    });

    it("excludes filtered inner rows from the pairs", () => {
        const pairs = executeJoin({
            option: {
                kind: "inner",
                innerSchemaId: 1 as never,
                outerKey,
                innerKey,
                innerOptions: withFilter(row => row.deletedAt == null),
                crossPlugin: false,
                semiJoinKeyThreshold: DEFAULT_SEMI_JOIN_KEY_THRESHOLD
            },
            outerRows: [{ id: 1 }],
            innerRows: [{ outerId: 1, deletedAt: new Date() }]
        });

        expect(pairs).toEqual([]);
    });
});
