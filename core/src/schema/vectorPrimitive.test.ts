import { s } from "./builder";
import { InferCreateType, InferType, SchemaTypes } from "./types";

/**
 * A vector is an array of numbers everywhere except where a backend chooses storage.
 *
 * These tests exist because that claim is easy to break silently. The inference rules resolve
 * a modified property through `ResolveWrapped`, which has no idea which class produced the
 * value — get the branch order wrong and `s.vector(3)` types as `never[]`, which is
 * assignable from nothing and shows up as a confusing error in unrelated code. The codegen
 * side fails even more quietly: a vector that clones by reference shares its array with the
 * change tracker's copy, so replacing an embedding produces no diff at all.
 */

const schema = s.define("documents", {
    id: s.string().key().identity(),
    title: s.string(),
    embedding: s.vector(3),
}).compile();

type Document = InferType<typeof schema>;

describe("s.vector", () => {

    it("declares its dimensions on the property", () => {
        const property = schema.properties.find(w => w.name === "embedding");

        expect(property?.type).toBe(SchemaTypes.Vector);
        expect(property?.dimensions).toBe(3);
    });

    it("keeps the dimensions through a modifier", () => {
        // `.optional()` returns a SchemaOptional, which is not a SchemaVector. The count
        // survives only because it lives on SchemaBase — see the comment there.
        const modified = s.define("documents", {
            id: s.string().key().identity(),
            embedding: s.vector(1536).optional(),
        }).compile();

        const property = modified.properties.find(w => w.name === "embedding");

        expect(property?.type).toBe(SchemaTypes.Vector);
        expect(property?.dimensions).toBe(1536);
    });

    it("rejects a dimension count that cannot describe a vector", () => {
        expect(() => s.vector(0)).toThrow();
        expect(() => s.vector(-1)).toThrow();
        expect(() => s.vector(1.5)).toThrow();
    });

    it("infers number[] on the read type", () => {
        const document: Document = { id: "1", title: "a", embedding: [1, 2, 3] };

        // A regression here is a compile error, which is the point. `never[]` would accept
        // `[]` and nothing else, so the assignment above is what actually holds the line.
        const first: number = document.embedding[0];

        expect(first).toBe(1);
    });

    it("infers number[] on the create type", () => {
        const created: InferCreateType<typeof schema> = { title: "a", embedding: [1, 2, 3] };

        expect(created.embedding).toEqual([1, 2, 3]);
    });

    it("infers number[] through a modifier", () => {
        const modified = s.define("documents", {
            id: s.string().key().identity(),
            embedding: s.vector(3).optional(),
            tagged: s.vector(3).tag("search"),
        }).compile();

        const document: InferType<typeof modified> = { id: "1", tagged: [1, 2, 3] };

        expect(document.embedding?.[0]).toBeUndefined();
        expect(document.tagged[0]).toBe(1);
    });

    it("clones by value, so a mutation does not reach the source", () => {
        const source = { id: "1", title: "a", embedding: [1, 2, 3] } as Document;
        const cloned = schema.clone(source);

        cloned.embedding[0] = 99;

        expect(source.embedding[0]).toBe(1);
    });

    it("compares by content rather than by reference", () => {
        const left = { id: "1", title: "a", embedding: [1, 2, 3] } as Document;
        const right = { id: "1", title: "a", embedding: [1, 2, 3] } as Document;
        const different = { id: "1", title: "a", embedding: [1, 2, 4] } as Document;

        expect(schema.compare(left, right)).toBe(true);
        expect(schema.compare(left, different)).toBe(false);
    });

    it("round-trips through serialize and deserialize", () => {
        const document = { id: "1", title: "a", embedding: [1, 2, 3] } as Document;
        const serialized = schema.serialize(document);

        expect(schema.deserialize(serialized as never)).toEqual(document);
    });
});
