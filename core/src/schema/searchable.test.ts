import { s } from "./builder";
import { HashType, SchemaTypes } from "./types";
import { compiledSchemaToJsonSchema, rehydrateSchemaFromJsonSchema } from "./utils/standardJsonSchema";

/**
 * `.searchable()` — a flag the datastore reads and no plugin ever sees.
 *
 * It exists to be RECOGNISED, like `s.vector()`. Nothing about storage, cloning, comparison or
 * serialization changes, so almost every way this can break is silent: the property is still
 * saved and still queryable, and only the search index is missing rows nobody looked for. These
 * tests pin the flag itself, because the feature that consumes it cannot.
 */

describe("s.string().searchable()", () => {

    it("marks the property on the compiled schema", () => {
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            title: s.string().searchable(),
            authorNote: s.string(),
        }).compile();

        const title = schema.properties.find(w => w.name === "title");
        const note = schema.properties.find(w => w.name === "authorNote");

        expect(title?.type).toBe(SchemaTypes.String);
        expect(title?.isSearchable).toBe(true);
        expect(note?.isSearchable).toBe(false);
    });

    it("can be enumerated off a compiled schema", () => {
        // How the collection builder decides whether `.searchIndex()` has anything to index.
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            title: s.string().searchable(),
            body: s.string({ maxLength: 4000 }).searchable(),
            authorNote: s.string(),
        }).compile();

        const searchable = schema.properties.filter(w => w.isSearchable).map(w => w.name);

        expect(searchable).toEqual(["title", "body"]);
    });

    it("survives optional and nullable", () => {
        // The reason the flag lives on SchemaBase and is copied. `.optional()` returns a
        // SchemaOptional, which is not a SchemaString, so an uncopied flag would vanish here.
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            subtitle: s.string().searchable().optional(),
            summary: s.string().searchable().nullable(),
            both: s.string().searchable().optional().nullable(),
        }).compile();

        expect(schema.properties.find(w => w.name === "subtitle")?.isSearchable).toBe(true);
        expect(schema.properties.find(w => w.name === "summary")?.isSearchable).toBe(true);
        expect(schema.properties.find(w => w.name === "both")?.isSearchable).toBe(true);
    });

    it("reads the same in either order", () => {
        // `.optional().searchable()` is the order most people write first. It must mean exactly
        // what `.searchable().optional()` means, or the modifier has an invisible rule.
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            subtitle: s.string().optional().searchable(),
            summary: s.string().nullable().searchable(),
        }).compile();

        const subtitle = schema.properties.find(w => w.name === "subtitle");
        const summary = schema.properties.find(w => w.name === "summary");

        expect(subtitle?.isSearchable).toBe(true);
        expect(subtitle?.isOptional).toBe(true);
        expect(summary?.isSearchable).toBe(true);
        expect(summary?.isNullable).toBe(true);
    });

    it("combines with maxLength", () => {
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            body: s.string({ maxLength: 4000 }).searchable(),
        }).compile();

        const body = schema.properties.find(w => w.name === "body");

        expect(body?.isSearchable).toBe(true);
        expect(body?.maxLength).toBe(4000);
    });

    it("changes nothing about the value", () => {
        // The whole claim of the modifier: recognised, not behaving. A round trip through the
        // schema's own serializer must be identical to one without the flag.
        const searchable = s.define("articles", {
            id: s.string().key(),
            title: s.string().searchable(),
        }).compile();

        const plain = s.define("articles", {
            id: s.string().key(),
            title: s.string(),
        }).compile();

        const entity = { id: "1", title: "Copper Pipe" };

        expect(searchable.serialize(entity as never)).toEqual(plain.serialize(entity as never));
        expect(searchable.clone(entity as never)).toEqual(plain.clone(entity as never));
        expect(searchable.hash(entity as never, HashType.Object)).toEqual(plain.hash(entity as never, HashType.Object));
    });

    describe("rejects what cannot be indexed", () => {

        it("does not offer searchable() on a non-string", () => {
            // The gate is the builder, not a runtime check, so the assertion IS the compile
            // error. `searchable()` is absent from SchemaNumber outright, and present on
            // SchemaOptional only when what it wraps is a string.
            //
            // Never invoked — these calls would throw at runtime precisely because the methods
            // do not exist. tsc checks the body regardless, and an unused `@ts-expect-error` is
            // itself an error, so a gate that stopped working fails the typecheck.
            const neverRun = () => s.define("articles", {
                id: s.string().key().identity(),
                // @ts-expect-error searchable() does not exist on a number
                hits: s.number().searchable(),
                // @ts-expect-error a SchemaOptional over a number fails the `this` constraint
                views: s.number().optional().searchable(),
                // @ts-expect-error nor does a SchemaNullable over a date
                seenAt: s.date().nullable().searchable(),
            });

            expect(typeof neverRun).toBe("function");

            // A string underneath is what the constraint is FOR, including a literal union —
            // its `T` is `"draft" | "published"`, not `string`.
            expect(() => s.define("articles", {
                id: s.string().key().identity(),
                state: s.string("draft", "published").optional().searchable(),
            }).compile()).not.toThrow();
        });

        it("reports a non-string as not searchable even if the raw flag is set", () => {
            // The type gate is erased at runtime, so a schema rebuilt from hand-written JSON can
            // set the flag on a number. PropertyInfo derives the answer from the declaration AND
            // the type, so no reader has to re-check.
            const views = s.number();
            (views as unknown as { isSearchable: boolean }).isSearchable = true;

            const schema = s.define("articles", {
                id: s.string().key().identity(),
                views,
            }).compile();

            expect(schema.properties.find(w => w.name === "views")?.isSearchable).toBe(false);
        });

        it("throws for a searchable string nested in an object", () => {
            // Type-checks, because `s.object()` takes any schema. v1 indexes root-level
            // properties only, and a silently unindexed property returns no rows for a query
            // the caller believes is covered.
            expect(() => s.define("articles", {
                id: s.string().key().identity(),
                meta: s.object({ blurb: s.string().searchable() }),
            }).compile()).toThrow(/root-level string properties only/);
        });

        it("throws for a property name too long for the index key", () => {
            const name = "a".repeat(101);

            expect(() => s.define("articles", {
                id: s.string().key().identity(),
                [name]: s.string().searchable(),
            }).compile()).toThrow(/100 characters or fewer/);
        });

        it("allows a property name at the limit", () => {
            const name = "a".repeat(100);

            const schema = s.define("articles", {
                id: s.string().key().identity(),
                [name]: s.string().searchable(),
            }).compile();

            expect(schema.properties.find(w => w.name === name)?.isSearchable).toBe(true);
        });

        it("ignores a long name that is not searchable", () => {
            // The budget only binds properties that appear in an index key.
            const name = "a".repeat(200);

            expect(() => s.define("articles", {
                id: s.string().key().identity(),
                [name]: s.string(),
            }).compile()).not.toThrow();
        });
    });

    it("survives a JSON Schema round trip", () => {
        // Exporting and rebuilding a schema must not quietly drop the flag; a rebuilt schema
        // that lost it indexes nothing and reports no error.
        const schema = s.define("articles", {
            id: s.string().key().identity(),
            title: s.string().searchable(),
        }).compile();

        const json = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false) as unknown as {
            properties: Record<string, { "x-routier"?: Record<string, unknown> }>
        };

        expect(json.properties.title["x-routier"]?.isSearchable).toBe(true);

        // The half that matters: rebuilding must restore the flag, not just record it.
        const rebuilt = rehydrateSchemaFromJsonSchema(json as unknown as Record<string, unknown>, "articles").compile();

        expect(rebuilt.properties.find(w => w.name === "title")?.isSearchable).toBe(true);
    });
});
