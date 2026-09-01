import { describe, it, expect } from '@jest/globals';
import { s } from '../schema';
import { evaluate, toPredicate, toStrictPredicate } from './evaluate';
import { toExpression } from './parser';
import {
    ComparatorExpression,
    Expression,
    OperatorExpression,
    PropertyExpression,
    ValueExpression,
} from './types';

/**
 * The evaluator runs a parsed tree against a row — the counterpart to `toSql`, for callers that
 * hold a tree but not the closure that produced it.
 *
 * **The rule everything here protects: it FAILS OPEN.** `undefined` means "cannot judge this",
 * and every caller reads that as keep the row. The reason is asymmetric: callers use this to
 * narrow something an authoritative predicate re-checks, so keeping a row costs one comparison
 * and dropping one loses data silently.
 */
const schema = s.define("evaluate_rows", {
    id: s.string().key(),
    name: s.string(),
    other: s.string().nullable(),
    rank: s.number(),
    active: s.boolean(),
    when: s.date(),
    tags: s.array(s.string()),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
}).compile();

/** Parses a real filter, so the trees under test are the ones the parser actually produces. */
const treeFor = (filter: (row: any) => boolean) => toExpression(schema as never, filter as never);

const row = {
    id: "a",
    name: "Alpha",
    rank: 20,
    active: true,
    when: new Date("2020-06-01T00:00:00.000Z"),
    tags: ["x", "y"],
    nested: { inner: { value: "deep" } },
};

describe("evaluate", () => {

    describe("comparators, over trees the parser produced", () => {

        it("evaluates equality, including negation", () => {
            expect(evaluate(treeFor(r => r.name === "Alpha"), row)).toBe(true);
            expect(evaluate(treeFor(r => r.name === "Beta"), row)).toBe(false);
            expect(evaluate(treeFor(r => r.name !== "Beta"), row)).toBe(true);
        });

        it("evaluates ordered comparisons", () => {
            expect(evaluate(treeFor(r => r.rank > 10), row)).toBe(true);
            expect(evaluate(treeFor(r => r.rank > 20), row)).toBe(false);
            expect(evaluate(treeFor(r => r.rank >= 20), row)).toBe(true);
            expect(evaluate(treeFor(r => r.rank < 10), row)).toBe(false);
            expect(evaluate(treeFor(r => r.rank <= 20), row)).toBe(true);
        });

        it("evaluates string patterns", () => {
            expect(evaluate(treeFor(r => r.name.startsWith("Al")), row)).toBe(true);
            expect(evaluate(treeFor(r => r.name.endsWith("ha")), row)).toBe(true);
            expect(evaluate(treeFor(r => r.name.includes("lph")), row)).toBe(true);
            expect(evaluate(treeFor(r => r.name.includes("zzz")), row)).toBe(false);
        });

        it("evaluates includes over an array property", () => {
            expect(evaluate(treeFor(r => r.tags.includes("x")), row)).toBe(true);
            expect(evaluate(treeFor(r => r.tags.includes("z")), row)).toBe(false);
        });

        // Only the forms the PARSER produces a tree for. `toLowerCase() === x` is not one of them
        // — it comes back `not-parsable` — so there is nothing for the evaluator to do with it.
        it("applies transformers", () => {
            expect(evaluate(treeFor(r => r.name.toLowerCase().includes("lph")), row)).toBe(true);
            expect(evaluate(treeFor(r => r.name.toLowerCase().includes("zzz")), row)).toBe(false);
            expect(evaluate(treeFor(r => r.name.length === 5), row)).toBe(true);
            expect(evaluate(treeFor(r => r.name.length > 3), row)).toBe(true);
            expect(evaluate(treeFor(r => r.tags.length === 2), row)).toBe(true);
        });

        it("reads a nested property through its path", () => {
            expect(evaluate(treeFor(r => r.nested.inner.value === "deep"), row)).toBe(true);
        });

        it("evaluates booleans", () => {
            expect(evaluate(treeFor(r => r.active === true), row)).toBe(true);
        });
    });

    // A Date compares by REFERENCE under `===`, so two Dates holding the same instant would be
    // unequal — which is not what a filter on a date means, and not what any backend does.
    it("compares Dates by value, not by reference", () => {
        const sameInstant = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: true,
            left: new PropertyExpression({ property: schema.getProperty("when") as never }),
            right: new ValueExpression({ value: new Date("2020-06-01T00:00:00.000Z") }),
        });

        expect(evaluate(sameInstant, row)).toBe(true);
    });

    it("orders Dates", () => {
        const after = new ComparatorExpression({
            comparator: "greater-than",
            negated: false,
            strict: true,
            left: new PropertyExpression({ property: schema.getProperty("when") as never }),
            right: new ValueExpression({ value: new Date("2020-01-01T00:00:00.000Z") }),
        });

        expect(evaluate(after, row)).toBe(true);
    });

    describe("failing open", () => {

        it("cannot judge a not-parsable tree", () => {
            expect(evaluate(Expression.NOT_PARSABLE, row)).toBeUndefined();
        });

        it("treats a tautology as excluding nothing", () => {
            expect(evaluate(Expression.EMPTY, row)).toBe(true);
        });

        /**
         * An absent property compared to a value is NOT uncertain — it is a definite no-match.
         *
         * Both authorities agree: the caller's own closure evaluates `undefined === "Alpha"` as
         * false, and SQL answers `NULL = 'Alpha'` with NULL, which excludes the row. Returning
         * `undefined` here would be over-cautious in the one place caution buys nothing.
         */
        it("judges a comparison against an absent property as a definite no-match", () => {
            expect(evaluate(treeFor(r => r.name === "Alpha"), {} as never)).toBe(false);
        });

        it("cannot judge a transformer over an absent value", () => {
            expect(evaluate(treeFor(r => r.name.toLowerCase() === "alpha"), {} as never)).toBeUndefined();
        });

        it("cannot judge shapes that do not compare", () => {
            const numberAgainstString = new ComparatorExpression({
                comparator: "greater-than",
                negated: false,
                strict: true,
                left: new PropertyExpression({ property: schema.getProperty("rank") as never }),
                right: new ValueExpression({ value: "not a number" }),
            });

            expect(evaluate(numberAgainstString, row)).toBeUndefined();
        });

        it("keeps the row through toPredicate whenever it cannot judge", () => {
            expect(toPredicate(Expression.NOT_PARSABLE)(row)).toBe(true);
            // A transformer over an absent value: no answer, so the row survives
            expect(toPredicate(treeFor(r => r.name.toLowerCase().includes("a")))({} as never)).toBe(true);

            // And still excludes what it CAN judge as false
            expect(toPredicate(treeFor(r => r.name === "Beta"))(row)).toBe(false);
        });
    });

    /**
     * One unevaluable side must not sink the whole tree.
     *
     * `false && anything` is false and `true || anything` is true, whatever the other side is. That
     * short-circuiting is what lets a partly-understood predicate narrow anything at all — without
     * it, one unfamiliar sub-expression makes the entire filter a no-op.
     */
    describe("short-circuiting around what it cannot judge", () => {

        const unknowable = Expression.NOT_PARSABLE;
        const definitelyTrue = treeFor(r => r.rank === 20);
        const definitelyFalse = treeFor(r => r.rank === 99);

        const and = (left: Expression, right: Expression) => new OperatorExpression({ operator: "&&", left, right });
        const or = (left: Expression, right: Expression) => new OperatorExpression({ operator: "||", left, right });

        it("resolves && when either side is definitely false", () => {
            expect(evaluate(and(definitelyFalse, unknowable), row)).toBe(false);
            expect(evaluate(and(unknowable, definitelyFalse), row)).toBe(false);
        });

        it("cannot resolve && when the known side is true", () => {
            expect(evaluate(and(definitelyTrue, unknowable), row)).toBeUndefined();
        });

        it("resolves || when either side is definitely true", () => {
            expect(evaluate(or(definitelyTrue, unknowable), row)).toBe(true);
            expect(evaluate(or(unknowable, definitelyTrue), row)).toBe(true);
        });

        it("cannot resolve || when the known side is false", () => {
            expect(evaluate(or(definitelyFalse, unknowable), row)).toBeUndefined();
        });

        it("resolves a fully known tree either way", () => {
            expect(evaluate(and(definitelyTrue, definitelyTrue), row)).toBe(true);
            expect(evaluate(or(definitelyFalse, definitelyFalse), row)).toBe(false);
        });
    });
});

describe('a template over a null column', () => {

    const row = {
        id: "a", name: "ada", other: null, rank: 1, active: true,
        when: new Date(0), tags: [], nested: { inner: { value: "v" } }
    } as never;

    it('renders null as "null", the way JavaScript does', () => {
        const closure = (x: any) => `${x.other}!` === "null!";
        const expression = toExpression(schema as never, closure as never, undefined as never);

        expect(closure(row)).toBe(true);
        expect(evaluate(expression, row)).toBe(true);
    });

    it('answers rather than refusing, so a wire-received filter does not throw', () => {
        const expression = toExpression(schema as never, ((x: any) => `${x.other}!` === "null!") as never, undefined as never);

        expect(toStrictPredicate(expression)(row)).toBe(true);
    });
});
