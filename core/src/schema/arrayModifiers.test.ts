import { describe, expect, it } from "@jest/globals";
import { s } from "./builder";
import { SchemaModifiers, SchemaTypes } from "./types";
import type { SchemaBase } from "./property/base/SchemaBase";

type Definition = SchemaBase<unknown, SchemaModifiers>;

const items = () => s.object({ name: s.string() }).array();

const wrapped: [string, () => Definition][] = [
    ["optional", () => items().optional()],
    ["nullable", () => items().nullable()],
    ["optional and nullable", () => items().optional().nullable()],
    ["default", () => items().default(() => [])],
    ["from", () => items().from("stored_items")],
    ["tag", () => items().tag("t")],
    ["index", () => items().index("i")],
    ["serialize", () => items().serialize(value => value.length)],
    ["deserialize", () => items().deserialize(() => [])],
];

const propertyOf = (definition: Definition) => {
    const schema = s.define("arrayModifiers", { id: s.string().key(), items: definition }).compile();
    const property = schema.properties.find(candidate => candidate.id === "items");

    if (property == null) {
        throw new Error("items is missing");
    }

    return property;
};

describe("an array with a modifier keeps its item schema", () => {
    it.each(wrapped)("%s, in the builder", (_, wrap) => {
        expect(wrap().innerSchema?.type).toBe(SchemaTypes.Object);
    });

    it.each(wrapped)("%s, in the compiled property", (_, wrap) => {
        expect(propertyOf(wrap()).innerSchema?.type).toBe(SchemaTypes.Object);
    });

    it("keeps the item's own properties", () => {
        const inner = propertyOf(items().optional()).innerSchema;

        expect(Object.keys(inner?.instance ?? {})).toEqual(["name"]);
    });

    it("keeps it for s.array(...)", () => {
        expect(propertyOf(s.array(s.string()).nullable()).innerSchema?.type).toBe(SchemaTypes.String);
    });

    it("keeps the item schema of an array of arrays", () => {
        const inner = propertyOf(s.array(s.array(s.number())).optional()).innerSchema;

        expect(inner?.type).toBe(SchemaTypes.Array);
        expect(inner?.innerSchema?.type).toBe(SchemaTypes.Number);
    });

    it("has no item schema on a property that is not an array", () => {
        expect(propertyOf(s.string().optional()).innerSchema).toBeUndefined();
    });
});

describe("an optional array uses its item schema at run time", () => {
    const schema = s.define("optionalArrays", {
        id: s.string().key(),
        dates: s.date().array().optional(),
        items: s.object({ name: s.string() }).array().nullable(),
    }).compile();

    const when = new Date("2026-01-02T03:04:05.000Z");

    it("stores dates as ISO strings", () => {
        expect(schema.serialize({ id: "a", dates: [when], items: null })).toMatchObject({ dates: [when.toISOString()] });
    });

    it("tracks a change inside an item", () => {
        const row = schema.enrich({ id: "a", items: [{ name: "x" }] }, "proxy");
        const tracked: { id: string; __tracking__?: { changes: Record<string, string> } } = row;

        const [first] = row.items ?? [];

        first.name = "y";

        expect(tracked.__tracking__?.changes).toEqual({ "items.0.name": "y" });
    });

    it("clones items, not their references", () => {
        const source = { id: "a", items: [{ name: "x" }] };
        const cloned = schema.clone(source);

        expect(cloned.items).toEqual(source.items);
        expect(cloned.items?.[0]).not.toBe(source.items[0]);
    });

    it("keeps a null array null", () => {
        expect(schema.clone({ id: "a", items: null }).items).toBeNull();
    });
});
