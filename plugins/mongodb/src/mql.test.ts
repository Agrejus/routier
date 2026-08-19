import { describe, expect, it } from "@jest/globals";
import { ComparatorExpression, Expression, OperatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { SchemaTypes, s } from "@routier/core/schema";
import { toExpression } from "@routier/core/expressions";
import { toMql } from "./mql";

/**
 * A property stub, matching the shape `toFieldPath` and `renderExprOperand` read.
 *
 * `parents` is the storage-side chain above this property, which is what produces a
 * dotted path. The real `PropertyInfo` derives it by walking `parent` links; stating it
 * directly keeps these tests about translation rather than about schema compilation.
 * The parser-driven suite at the bottom covers the real thing.
 */
const prop = (
    name: string,
    options?: { from?: string; parents?: string[]; type?: SchemaTypes }
) =>
    new PropertyExpression({
        property: {
            name,
            from: options?.from ?? null,
            type: options?.type ?? SchemaTypes.String,
            getResolvedName: () => options?.from ?? name,
            getParentPathArray: () => options?.parents ?? [],
        } as any,
    });

const val = (value: unknown) => new ValueExpression({ value });

const cmp = (
    comparator: string,
    left: Expression,
    right: Expression,
    negated = false
) =>
    new ComparatorExpression({
        comparator: comparator as any,
        negated,
        strict: false,
        left,
        right,
    });

describe("mql expression translator", () => {

    describe("comparators with the property on the left", () => {

        it("renders equals as a field predicate", () => {
            expect(toMql(cmp("equals", prop("name"), val("James")))).toEqual({
                name: { $eq: "James" },
            });
        });

        it("renders negated equals as $ne rather than wrapping in $not", () => {
            expect(toMql(cmp("equals", prop("name"), val("James"), true))).toEqual({
                name: { $ne: "James" },
            });
        });

        it.each([
            ["greater-than", "$gt", "$lte"],
            ["greater-than-equals", "$gte", "$lt"],
            ["less-than", "$lt", "$gte"],
            ["less-than-equals", "$lte", "$gt"],
        ])("renders %s as %s and its negation as %s", (comparator, plain, negated) => {
            expect(toMql(cmp(comparator, prop("price"), val(10)))).toEqual({
                price: { [plain]: 10 },
            });
            expect(toMql(cmp(comparator, prop("price"), val(10), true))).toEqual({
                price: { [negated]: 10 },
            });
        });
    });

    /**
     * The defect class this guards is the MQL form of the SQL operand-order bug: MQL has
     * no `{ 5: { $lt: "$price" } }`, so a translator that ignores which side the property
     * is on emits a valid query for the OPPOSITE range.
     */
    describe("comparators with the property on the right", () => {

        it("mirrors greater-than into less-than", () => {
            // `10 > entity.price` means price < 10
            expect(toMql(cmp("greater-than", val(10), prop("price")))).toEqual({
                price: { $lt: 10 },
            });
        });

        it("mirrors less-than-equals into greater-than-equals", () => {
            // `10 <= entity.price` means price >= 10
            expect(toMql(cmp("less-than-equals", val(10), prop("price")))).toEqual({
                price: { $gte: 10 },
            });
        });

        it("leaves equals unmirrored", () => {
            expect(toMql(cmp("equals", val("James"), prop("name")))).toEqual({
                name: { $eq: "James" },
            });
        });

        it("mirrors before negating, so both transformations apply", () => {
            // `!(10 > entity.price)` means price >= 10
            expect(toMql(cmp("greater-than", val(10), prop("price"), true))).toEqual({
                price: { $gte: 10 },
            });
        });
    });

    describe("null", () => {

        it("renders equals null as a plain null predicate", () => {
            expect(toMql(cmp("equals", prop("deletedAt"), val(null)))).toEqual({
                deletedAt: { $eq: null },
            });
        });

        it("renders negated equals null as $ne", () => {
            expect(toMql(cmp("equals", prop("deletedAt"), val(null), true))).toEqual({
                deletedAt: { $ne: null },
            });
        });

        it("keeps the field as the key when null is the left operand", () => {
            // The SQL translator's `? IS NULL` tautology has a direct MQL analogue:
            // treating the literal as the key would produce `{ null: ... }`.
            expect(toMql(cmp("equals", val(null), prop("deletedAt")))).toEqual({
                deletedAt: { $eq: null },
            });
        });
    });

    describe("string patterns", () => {

        it("anchors starts-with at the front", () => {
            expect(toMql(cmp("starts-with", prop("name"), val("Ad")))).toEqual({
                name: { $regex: "^Ad" },
            });
        });

        it("anchors ends-with at the end", () => {
            expect(toMql(cmp("ends-with", prop("name"), val("da")))).toEqual({
                name: { $regex: "da$" },
            });
        });

        it("leaves includes unanchored", () => {
            expect(toMql(cmp("includes", prop("name"), val("d")))).toEqual({
                name: { $regex: "d" },
            });
        });

        it("escapes regex metacharacters so a literal stays literal", () => {
            // Unescaped, `a.c` matches "abc" — a wrong-rows bug, not a crash.
            expect(toMql(cmp("starts-with", prop("name"), val("a.c+d")))).toEqual({
                name: { $regex: "^a\\.c\\+d" },
            });
        });

        it("negates a pattern with $not over a RegExp", () => {
            // $not requires a RegExp instance; it rejects a `$regex` string operator.
            expect(toMql(cmp("starts-with", prop("name"), val("Ad"), true))).toEqual({
                name: { $not: /^Ad/ },
            });
        });

        it("rejects a null operand rather than matching the literal 'null'", () => {
            expect(() => toMql(cmp("starts-with", prop("name"), val(null)))).toThrow(
                /not supported for starts-with/
            );
        });
    });

    describe("includes", () => {

        it("uses $in when the value is an array literal", () => {
            expect(toMql(cmp("includes", prop("status"), val(["a", "b"])))).toEqual({
                status: { $in: ["a", "b"] },
            });
        });

        it("uses $nin when a value-array includes is negated", () => {
            expect(toMql(cmp("includes", prop("status"), val(["a", "b"]), true))).toEqual({
                status: { $nin: ["a", "b"] },
            });
        });

        it("uses plain equality for membership in an array property", () => {
            // Equality against an array field is membership in Mongo, and unlike a regex
            // it can use a multikey index.
            const tags = prop("tags", { type: SchemaTypes.Array });

            expect(toMql(cmp("includes", tags, val("x")))).toEqual({ tags: "x" });
        });

        it("uses $ne for negated membership in an array property", () => {
            const tags = prop("tags", { type: SchemaTypes.Array });

            expect(toMql(cmp("includes", tags, val("x"), true))).toEqual({
                tags: { $ne: "x" },
            });
        });
    });

    describe("field paths", () => {

        it("resolves a renamed property to its stored name", () => {
            expect(toMql(cmp("equals", prop("label", { from: "wire_label" }), val("x")))).toEqual({
                wire_label: { $eq: "x" },
            });
        });

        it("addresses a nested property with dot notation", () => {
            const nested = prop("value", { parents: ["payload", "inner"] });

            expect(toMql(cmp("equals", nested, val("x")))).toEqual({
                "payload.inner.value": { $eq: "x" },
            });
        });
    });

    describe("operators", () => {

        it("renders && as $and", () => {
            const expr = new OperatorExpression({
                operator: "&&",
                left: cmp("equals", prop("name"), val("James")),
                right: cmp("greater-than", prop("price"), val(10)),
            });

            expect(toMql(expr)).toEqual({
                $and: [{ name: { $eq: "James" } }, { price: { $gt: 10 } }],
            });
        });

        it("renders || as $or", () => {
            const expr = new OperatorExpression({
                operator: "||",
                left: cmp("equals", prop("name"), val("James")),
                right: cmp("equals", prop("name"), val("Bob")),
            });

            expect(toMql(expr)).toEqual({
                $or: [{ name: { $eq: "James" } }, { name: { $eq: "Bob" } }],
            });
        });

        it("nests operators", () => {
            const expr = new OperatorExpression({
                operator: "&&",
                left: cmp("equals", prop("category"), val("book")),
                right: new OperatorExpression({
                    operator: "||",
                    left: cmp("less-than", prop("price"), val(10)),
                    right: cmp("greater-than", prop("price"), val(100)),
                }),
            });

            expect(toMql(expr)).toEqual({
                $and: [
                    { category: { $eq: "book" } },
                    { $or: [{ price: { $lt: 10 } }, { price: { $gt: 100 } }] },
                ],
            });
        });

        it("collapses a one-sided operator to the operand itself", () => {
            const expr = new OperatorExpression({
                operator: "&&",
                left: cmp("equals", prop("name"), val("James")),
            });

            expect(toMql(expr)).toEqual({ name: { $eq: "James" } });
        });
    });

    describe("transformers", () => {

        it("applies a value-side transformer to the literal, not the query", () => {
            const value = val("JAMES");
            value.transformer = "to-lower-case";

            expect(toMql(cmp("equals", prop("name"), value))).toEqual({
                name: { $eq: "james" },
            });
        });

        it("switches to $expr for a property-side to-lower-case", () => {
            const property = prop("name");
            property.transformer = "to-lower-case";

            expect(toMql(cmp("equals", property, val("james")))).toEqual({
                $expr: { $eq: [{ $toLower: "$name" }, { $literal: "james" }] },
            });
        });

        it("uses $strLenCP for the length of a string property", () => {
            const property = prop("name");
            property.transformer = "length";

            expect(toMql(cmp("greater-than", property, val(3)))).toEqual({
                $expr: { $gt: [{ $strLenCP: "$name" }, { $literal: 3 }] },
            });
        });

        it("uses $size for the length of an array property", () => {
            const property = prop("tags", { type: SchemaTypes.Array });
            property.transformer = "length";

            expect(toMql(cmp("equals", property, val(2)))).toEqual({
                $expr: { $eq: [{ $size: "$tags" }, { $literal: 2 }] },
            });
        });

        it("mirrors inside $expr when the transformed property is on the right", () => {
            const property = prop("name");
            property.transformer = "length";

            // `3 < entity.name.length` — operands stay in source order here because
            // $expr takes an array, so no mirroring is needed, only correct placement.
            expect(toMql(cmp("less-than", val(3), property))).toEqual({
                $expr: { $lt: [{ $literal: 3 }, { $strLenCP: "$name" }] },
            });
        });

        it("renders a pattern against a transformed property with $regexMatch", () => {
            const property = prop("name");
            property.transformer = "to-lower-case";

            expect(toMql(cmp("starts-with", property, val("ad")))).toEqual({
                $expr: { $regexMatch: { input: { $toLower: "$name" }, regex: "^ad" } },
            });
        });
    });

    describe("property-to-property comparison", () => {

        it("falls back to $expr, since neither side can be a field key", () => {
            expect(toMql(cmp("greater-than", prop("price"), prop("cost")))).toEqual({
                $expr: { $gt: ["$price", "$cost"] },
            });
        });
    });

    describe("edge cases", () => {

        it("renders an empty expression as a match-all document", () => {
            expect(toMql(Expression.EMPTY)).toEqual({});
        });

        it("throws on an unknown comparator", () => {
            expect(() => toMql(cmp("sounds-like", prop("name"), val("James")))).toThrow(
                /Unsupported comparator/
            );
        });

        /**
         * Core hands back this node for a filter it has no rule for, so it reaches the
         * translator in normal use. The message has to say what the caller should do —
         * quietly matching everything would turn the query into a full scan.
         */
        it("names the memory fallback when the expression is not parsable", () => {
            expect(() => toMql(Expression.NOT_PARSABLE)).toThrow(/Evaluate it in memory/);
        });
    });
});

/**
 * The same translator over expressions the real parser produced.
 *
 * The stubs above pin the mapping precisely but share the translator's own assumptions
 * about `PropertyInfo`. These cases prove the two agree — that a filter a caller actually
 * writes reaches MQL intact.
 */
describe("mql over parsed expressions", () => {

    const schema = s.define("mql_products", {
        _id: s.string().key().identity(),
        name: s.string(),
        price: s.number(),
        label: s.string().from("wire_label"),
        tags: s.array(s.string()),
        payload: s.object({ inner: s.object({ value: s.string() }) }),
    }).compile();

    const parse = (fn: any, params?: any) => toExpression(schema as any, fn, params);

    it("translates a simple equality", () => {
        expect(toMql(parse((x: any) => x.name === "James"))).toEqual({
            name: { $eq: "James" },
        });
    });

    it("translates a conjunction", () => {
        expect(toMql(parse((x: any) => x.name === "James" && x.price > 10))).toEqual({
            $and: [{ name: { $eq: "James" } }, { price: { $gt: 10 } }],
        });
    });

    it("translates a renamed property to its stored name", () => {
        expect(toMql(parse((x: any) => x.label === "hello"))).toEqual({
            wire_label: { $eq: "hello" },
        });
    });

    it("translates a nested property to a dotted path", () => {
        expect(toMql(parse((x: any) => x.payload.inner.value === "deep"))).toEqual({
            "payload.inner.value": { $eq: "deep" },
        });
    });

    it("translates a parameterised filter", () => {
        const expr = parse(([x, p]: any) => x.price > p.min, { min: 25 });

        expect(toMql(expr)).toEqual({ price: { $gt: 25 } });
    });

    it("translates a reversed comparison to the mirrored operator", () => {
        expect(toMql(parse((x: any) => 10 > x.price))).toEqual({
            price: { $lt: 10 },
        });
    });

    it("translates startsWith", () => {
        expect(toMql(parse((x: any) => x.name.startsWith("Ad")))).toEqual({
            name: { $regex: "^Ad" },
        });
    });
});
