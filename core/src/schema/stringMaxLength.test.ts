import { s } from "./builder";
import { InferType, SchemaTypes } from "./types";

/**
 * `s.string({ maxLength })` — a declaration one backend reads and the rest ignore.
 *
 * These tests exist for two reasons. The options object shares a parameter position with the
 * literal list, so the overload has to tell `s.string("draft")` from `s.string({ maxLength: 8 })`
 * at runtime; get that wrong and a literal union silently becomes an unconstrained string, which
 * nothing else would catch. And the length has to survive a modifier, which is the trap
 * `SchemaBase.maxLength` documents: `.optional()` returns a `SchemaOptional`, so anything
 * reachable only through `SchemaString` is gone.
 */

describe("s.string maxLength", () => {

    it("declares the length on the property", () => {
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            body: s.string({ maxLength: 4000 }),
        }).compile();

        const property = schema.properties.find(w => w.name === "body");

        expect(property?.type).toBe(SchemaTypes.String);
        expect(property?.maxLength).toBe(4000);
    });

    it("leaves maxLength null when nothing is declared", () => {
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            title: s.string(),
        }).compile();

        // Null rather than 255. The default belongs to the backend that has a default, not to
        // the declaration — every other backend stores strings unbounded.
        expect(schema.properties.find(w => w.name === "title")?.maxLength).toBeNull();
    });

    it("keeps the length through a modifier", () => {
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            body: s.string({ maxLength: 4000 }).optional(),
            note: s.string({ maxLength: 120 }).nullable(),
        }).compile();

        expect(schema.properties.find(w => w.name === "body")?.maxLength).toBe(4000);
        expect(schema.properties.find(w => w.name === "note")?.maxLength).toBe(120);
    });

    it("rejects a length that cannot describe a string", () => {
        expect(() => s.string({ maxLength: 0 })).toThrow();
        expect(() => s.string({ maxLength: -1 })).toThrow();
        expect(() => s.string({ maxLength: 1.5 })).toThrow();
    });

    describe("alongside literals", () => {

        it("still builds a literal union with no options", () => {
            const schema = s.define("articles", {
                id: s.string().key().identity(),
                state: s.string("draft", "published"),
            }).compile();

            const property = schema.properties.find(w => w.name === "state");

            expect(property?.literals).toEqual(["draft", "published"]);
            expect(property?.maxLength).toBeNull();
        });

        it("builds both when options lead", () => {
            const schema = s.define("articles", {
                id: s.string().key().identity(),
                state: s.string({ maxLength: 9 }, "draft", "published"),
            }).compile();

            const property = schema.properties.find(w => w.name === "state");

            // The literals must not absorb the options object. If the overload misreads the
            // first argument the union becomes `[{...}, "draft", "published"]`, which types as
            // a plain string and passes every other test in this file.
            expect(property?.literals).toEqual(["draft", "published"]);
            expect(property?.maxLength).toBe(9);
        });

        it("narrows the read type to the literal union", () => {
            const schema = s.define("articles", {
                id: s.string().key().identity(),
                state: s.string({ maxLength: 9 }, "draft", "published"),
            }).compile();

            type Article = InferType<typeof schema>;

            const article: Article = { id: "1", state: "draft" };

            expect(article.state).toBe("draft");

            // A regression here is a compile error, which is the point: the options overload
            // must not widen the union back to `string`.
            // @ts-expect-error "archived" is not one of the declared literals
            const wrong: Article = { id: "2", state: "archived" };

            expect(wrong.state).toBe("archived");
        });
    });
});
