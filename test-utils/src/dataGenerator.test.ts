import { describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { generateData } from "./dataGenerator";

describe("generateData", () => {
    it("generates a value for every root property", () => {
        const schema = s.define("gen_flat", {
            id: s.string().key(),
            text: s.string(),
            count: s.number(),
            flag: s.boolean(),
        }).compile();

        const [entity] = generateData(schema, 1) as any[];

        expect(typeof entity.id).toBe("string");
        expect(typeof entity.text).toBe("string");
        expect(typeof entity.count).toBe("number");
        expect(typeof entity.flag).toBe("boolean");
    });

    it("nests object values instead of hoisting leaf names to the root", () => {
        const schema = s.define("gen_nested", {
            id: s.string().key(),
            nested: s.object({ inner: s.object({ value: s.string() }) }),
        }).compile();

        const [entity] = generateData(schema, 1) as any[];

        expect(typeof entity.nested.inner.value).toBe("string");
        // `schema.properties` is flat, so generating over it by leaf name used to write
        // stray root-level `inner` and `value` keys that no schema property describes.
        expect(Object.keys(entity).sort()).toEqual(["id", "nested"]);
    });

    it("does not emit root keys for deeply nested children", () => {
        const schema = s.define("gen_nested3", {
            id: s.string().key(),
            a: s.object({ b: s.object({ c: s.object({ d: s.string() }) }) }),
        }).compile();

        const [entity] = generateData(schema, 1) as any[];

        expect(Object.keys(entity).sort()).toEqual(["a", "id"]);
        expect(typeof entity.a.b.c.d).toBe("string");
    });

    it("skips identity properties so the store can assign them", () => {
        const schema = s.define("gen_identity", {
            id: s.string().key().identity(),
            text: s.string(),
        }).compile();

        const [entity] = generateData(schema, 1) as any[];

        expect(entity.id).toBeUndefined();
        expect(typeof entity.text).toBe("string");
    });

    it("generates the requested count", () => {
        const schema = s.define("gen_count", { id: s.string().key() }).compile();

        expect(generateData(schema, 0)).toHaveLength(0);
        expect(generateData(schema, 5)).toHaveLength(5);
    });

    it("respects literal unions", () => {
        const schema = s.define("gen_literals", {
            id: s.string().key(),
            choice: s.string("alpha", "beta"),
        }).compile();

        for (const entity of generateData(schema, 10) as any[]) {
            expect(["alpha", "beta"]).toContain(entity.choice);
        }
    });

    it("applies literal and function defaults", () => {
        const schema = s.define("gen_defaults", {
            id: s.string().key(),
            fromLiteral: s.string().default("literal-default"),
            fromFn: s.string().default(() => "fn-default"),
        }).compile();

        const [entity] = generateData(schema, 1) as any[];

        expect(entity.fromLiteral).toBe("literal-default");
        expect(entity.fromFn).toBe("fn-default");
    });

    it("generates arrays of the declared element type", () => {
        const schema = s.define("gen_arrays", {
            id: s.string().key(),
            strings: s.array(s.string()),
            numbers: s.array(s.number()),
        }).compile();

        const [entity] = generateData(schema, 1) as any[];

        expect(Array.isArray(entity.strings)).toBe(true);
        expect(entity.strings.length).toBeGreaterThan(0);
        for (const value of entity.strings) {
            expect(typeof value).toBe("string");
        }
        for (const value of entity.numbers) {
            expect(typeof value).toBe("number");
        }
    });
});
