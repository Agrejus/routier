import { describe, it, expect } from '@jest/globals';
import { s } from '@routier/core/schema';
import { splitTopLevelConjuncts, splitTupleFilter, tupleRootsAndBody } from './conjuncts';

/**
 * Splitting a post-join `where` so the half belonging to one side can narrow that side's read.
 *
 * The safety property under all of this: a conjunct is only assigned to a side when it parses
 * cleanly against THAT side's schema and root alone. Anything unclear is dropped from the result,
 * and the caller's own filter still runs over the pairs — so a miss costs speed, never rows.
 */
const teamSchema = s.define("split_teams", {
    id: s.string().key(),
    name: s.string(),
    region: s.string(),
}).compile();

const memberSchema = s.define("split_members", {
    id: s.string().key(),
    teamId: s.string(),
    rank: s.number(),
}).compile();

const split = (filter: (pair: any) => boolean) =>
    splitTupleFilter({ filter, outerSchema: teamSchema, innerSchema: memberSchema });

describe("splitTopLevelConjuncts", () => {

    it("splits on top-level &&", () => {
        expect(splitTopLevelConjuncts("a === 1 && b === 2 && c === 3")).toEqual(["a === 1", "b === 2", "c === 3"]);
    });

    it("returns the whole source when there is nothing to split", () => {
        expect(splitTopLevelConjuncts("a === 1")).toEqual(["a === 1"]);
    });

    // A conjunct inside parentheses is not independently true of a matching row, so lifting it out
    // would change the predicate rather than narrow it.
    it("does not split inside parentheses", () => {
        expect(splitTopLevelConjuncts("a === 1 && (b === 2 || c === 3)")).toEqual(["a === 1", "(b === 2 || c === 3)"]);
        expect(splitTopLevelConjuncts("(a === 1 && b === 2) || c === 3")).toEqual(["(a === 1 && b === 2) || c === 3"]);
    });

    it("does not split inside brackets or braces", () => {
        expect(splitTopLevelConjuncts("f([1 && 2]) && b === 2")).toEqual(["f([1 && 2])", "b === 2"]);
    });

    it("does not split inside a string literal", () => {
        expect(splitTopLevelConjuncts(`a === "x && y" && b === 2`)).toEqual([`a === "x && y"`, "b === 2"]);
        expect(splitTopLevelConjuncts(`a === 'x && y' && b === 2`)).toEqual([`a === 'x && y'`, "b === 2"]);
        expect(splitTopLevelConjuncts("a === `x && y` && b === 2")).toEqual(["a === `x && y`", "b === 2"]);
    });

    it("is not fooled by an escaped quote", () => {
        expect(splitTopLevelConjuncts(`a === "x\\" && y" && b === 2`)).toEqual([`a === "x\\" && y"`, "b === 2"]);
    });
});

describe("tupleRootsAndBody", () => {

    it("reads both roots and the body from an expression body", () => {
        expect(tupleRootsAndBody("([p, m]) => p.id === m.teamId")).toEqual({
            outerRoot: "p", innerRoot: "m", body: "p.id === m.teamId"
        });
    });

    it("unwraps a single-return block body", () => {
        expect(tupleRootsAndBody("([p, m]) => { return p.id === m.teamId; }")).toEqual({
            outerRoot: "p", innerRoot: "m", body: "p.id === m.teamId"
        });
    });

    it("accepts an unparenthesised parameter list", () => {
        expect(tupleRootsAndBody("[p, m] => p.id === m.teamId")?.outerRoot).toBe("p");
    });

    // Anything that is not a two-element destructure is left alone rather than guessed at
    it("returns null for a shape it does not understand", () => {
        expect(tupleRootsAndBody("(x) => x.id === 1")).toBeNull();
        expect(tupleRootsAndBody("([p, m, extra]) => true")).toBeNull();
        expect(tupleRootsAndBody("([p, ...rest]) => true")).toBeNull();
        expect(tupleRootsAndBody("no arrow here")).toBeNull();
    });
});

describe("splitTupleFilter", () => {

    it("assigns each single-side conjunct to its own side", () => {
        const result = split(([p, m]) => p.region === "east" && m.rank > 10);

        expect(result.map(x => x.side)).toEqual(["outer", "inner"]);
    });

    it("drops a conjunct spanning both sides", () => {
        expect(split(([p, m]) => p.name === m.teamId)).toEqual([]);
    });

    it("keeps the single-side conjuncts of a filter that also spans both", () => {
        const result = split(([p, m]) => p.region === "east" && p.name === m.teamId && m.rank > 10);

        expect(result.map(x => x.side)).toEqual(["outer", "inner"]);
    });

    it("splits a filter that is one conjunct on one side", () => {
        expect(split(([, m]) => m.rank >= 30).map(x => x.side)).toEqual([]);
        expect(split(([p, m]) => m.rank >= 30).map(x => x.side)).toEqual(["inner"]);
    });

    it("drops a conjunct naming a property neither schema declares", () => {
        expect(split(([p, m]) => (p as any).nope === 1)).toEqual([]);
    });

    it("drops everything when the lambda is not a tuple destructure", () => {
        expect(splitTupleFilter({ filter: (x: any) => x.region === "east", outerSchema: teamSchema, innerSchema: memberSchema })).toEqual([]);
        expect(splitTupleFilter({ filter: "not a function", outerSchema: teamSchema, innerSchema: memberSchema })).toEqual([]);
    });

    it("produces a predicate that matches the conjunct it came from", () => {
        const [outer, inner] = split(([p, m]) => p.region === "east" && m.rank > 10);

        const keepsOuter = outer.filter.filter as unknown as (row: unknown) => boolean;
        const keepsInner = inner.filter.filter as unknown as (row: unknown) => boolean;

        expect(keepsOuter({ region: "east" })).toBe(true);
        expect(keepsOuter({ region: "west" })).toBe(false);
        expect(keepsInner({ rank: 20 })).toBe(true);
        expect(keepsInner({ rank: 5 })).toBe(false);
    });

    // The pushed-down filter carries a real expression, which is what a SQL or Mongo backend
    // translates into a narrowed read. Without it the option would run in memory and save nothing.
    it("carries a pushable expression, not a not-parsable one", () => {
        const [outer] = split(([p, m]) => p.region === "east" && m.rank > 10);

        expect(outer.filter.expression.type).toBe("comparator");
    });
});
