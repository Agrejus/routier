import { describe, it, expect } from '@jest/globals';
import { s } from '../schema';
import { evaluate } from './evaluate';
import { toExpression } from './parser';
import { Expression } from './types';

/**
 * Can an expression cross a wire as it stands today?
 *
 * The test is not "does it round-trip to a similar object" — it is whether the rebuilt tree is
 * INDISTINGUISHABLE to the things that consume one. Two consumers exist, and they exercise different
 * parts: `evaluate` reads values and property paths at runtime, and the SQL builders read the same
 * tree to emit a statement. If both give byte-identical answers before and after, the tree survived.
 *
 * Every case goes through `JSON.parse(JSON.stringify(...))`, so nothing passes by holding a
 * reference the wire would have dropped.
 */
const schema = s.define("wire_rows", {
    id: s.string().key(),
    name: s.string(),
    rank: s.number(),
    active: s.boolean(),
    when: s.date(),
    tags: s.array(s.string()),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
    renamed: s.string().from("rn"),
}).compile();

const row = {
    id: "a",
    name: "Alpha",
    rank: 20,
    active: true,
    when: new Date("2020-06-01T00:00:00.000Z"),
    tags: ["x", "y"],
    nested: { inner: { value: "deep" } },
    renamed: "here",
};

/** The wire: serialize, stringify, parse, rebuild. */
const overTheWire = (expression: Expression) =>
    Expression.fromJson(JSON.parse(JSON.stringify(Expression.toJson(expression))), schema as never);

const FILTERS: Array<[string, (r: any) => boolean]> = [
    ["equality", r => r.name === "Alpha"],
    ["negated equality", r => r.name !== "Beta"],
    ["loose equality", r => r.rank == 20],
    ["greater than", r => r.rank > 10],
    ["greater than or equal", r => r.rank >= 20],
    ["less than", r => r.rank < 99],
    ["less than or equal", r => r.rank <= 20],
    ["boolean", r => r.active === true],
    ["null check", r => r.name === null],
    ["starts with", r => r.name.startsWith("Al")],
    ["ends with", r => r.name.endsWith("ha")],
    ["includes on a string", r => r.name.includes("lph")],
    ["includes on an array", r => r.tags.includes("x")],
    ["negated includes", r => !r.tags.includes("z")],
    ["transformer plus comparator", r => r.name.toLowerCase().includes("lph")],
    ["length", r => r.name.length === 5],
    ["length compared", r => r.name.length > 3],
    ["nested path", r => r.nested.inner.value === "deep"],
    ["renamed property", r => r.renamed === "here"],
    ["and", r => r.name === "Alpha" && r.rank > 10],
    ["or", r => r.name === "Beta" || r.rank > 10],
    ["mixed and/or", r => r.name === "Alpha" && (r.rank > 100 || r.active === true)],
    ["three conjuncts", r => r.name === "Alpha" && r.rank > 10 && r.active === true],
];

describe("expression serialization", () => {

    describe("round-trips every filter shape the parser produces", () => {

        for (const [label, filter] of FILTERS) {
            it(label, () => {
                const original = toExpression(schema as never, filter as never);

                // Guard the test itself: a filter the parser rejects would make this vacuous
                expect(Expression.isNotParsable(original)).toBe(false);

                const rebuilt = overTheWire(original);

                // The runtime answer is the same
                expect(evaluate(rebuilt, row)).toBe(evaluate(original, row));
                // ...and it is a real answer, not two matching `undefined`s
                expect(evaluate(rebuilt, row)).not.toBeUndefined();
            });
        }
    });

    describe("values JSON cannot carry as they are", () => {

        it("keeps a Date as the same instant", () => {
            const original = toExpression(schema as never, ((([r, p]: [any, any]) => r.when === p.when)) as never, { when: row.when });
            const rebuilt = overTheWire(original);

            expect(evaluate(rebuilt, row)).toBe(true);
        });

        it("keeps undefined distinct from null", () => {
            const undefinedCheck = toExpression(schema as never, ((r: any) => r.name === undefined) as never);
            const nullCheck = toExpression(schema as never, ((r: any) => r.name === null) as never);

            expect(evaluate(overTheWire(undefinedCheck), { ...row, name: undefined } as never)).toBe(true);
            expect(evaluate(overTheWire(nullCheck), { ...row, name: null } as never)).toBe(true);

            // And they are not interchangeable — a strict comparison tells them apart
            expect(evaluate(overTheWire(undefinedCheck), { ...row, name: null } as never)).toBe(false);
        });

        it("keeps an array value, as `includes` needs", () => {
            const original = toExpression(schema as never, ((([r, p]: [any, any]) => p.names.includes(r.name))) as never, { names: ["Alpha", "Beta"] });
            const rebuilt = overTheWire(original);

            expect(evaluate(rebuilt, row)).toBe(true);
            expect(evaluate(rebuilt, { ...row, name: "Gamma" })).toBe(false);
        });

        it("refuses a value it cannot represent, rather than dropping it", () => {
            const withFunction = toExpression(schema as never, ((r: any) => r.name === "Alpha") as never) as never as { right: { value: unknown } };
            withFunction.right.value = () => "nope";

            expect(() => Expression.toJson(withFunction as never)).toThrow(/Cannot serialize this filter value/);
        });
    });

    describe("the sentinel trees", () => {

        /**
         * `toJson` represents them faithfully — it is a serializer, and a faithful one has no
         * opinion about what the tree means.
         *
         * Refusing to SEND a not-parsable filter is a decision made a layer up, at the wire
         * boundary, where the intent matters. See `serializeQueryOptions`.
         */
        it("round-trips empty and not-parsable", () => {
            expect(overTheWire(Expression.EMPTY).type).toBe("empty");
            expect(overTheWire(Expression.NOT_PARSABLE).type).toBe("not-parsable");
        });

        // An unparsable tree has no runtime answer either, so a receiver rebuilding one gets a
        // predicate that refuses rather than one that guesses
        it("gives a not-parsable tree no runtime answer", () => {
            expect(evaluate(overTheWire(Expression.NOT_PARSABLE), row)).toBeUndefined();
        });
    });

    /**
     * A path the receiver does not declare THROWS rather than degrading to `not-parsable`.
     *
     * On a server, a filter that silently stops filtering returns rows the requester was never
     * supposed to see. That is the one failure here worse than an error.
     */
    it("refuses to rebind a property the schema does not declare", () => {
        const other = s.define("wire_other", { id: s.string().key(), somethingElse: s.string() }).compile();
        const original = toExpression(schema as never, ((r: any) => r.name === "Alpha") as never);
        const json = JSON.parse(JSON.stringify(Expression.toJson(original)));

        expect(() => Expression.fromJson(json, other as never)).toThrow(/does not declare the property/);
    });

    it("rebinds to the RECEIVER's property, not a copy of the sender's", () => {
        const original = toExpression(schema as never, ((r: any) => r.renamed === "here") as never) as never as { left: { property: unknown } };
        const rebuilt = overTheWire(original as never) as never as { left: { property: unknown } };

        // Identity, not equality: the rebound property is the receiver's own PropertyInfo, which is
        // what makes `from`-renamed storage names and every generated accessor correct downstream.
        expect(rebuilt.left.property).toBe(schema.getProperty("renamed"));
        expect(rebuilt.left.property).toBe(original.left.property);
    });
});
