import { describe, expect, it } from "@jest/globals";
import { s } from "../schema/builder";
import { HashType } from "../schema/types";
import type { InferType } from "../schema";

/**
 * Regression tests for hardened codegen paths: property-order independence,
 * nullable-object children, array and date copies, enrichment defaults,
 * merge into missing destination parents, and hash/compare/strip coverage
 * of arrays, functions, and computed properties.
 */

describe("Generated handlers (hardening)", () => {
    describe("property order independence", () => {
        it("compiles when an object property is declared before the key", () => {
            const schema = s.define("objectFirst", {
                profile: s.object({
                    city: s.string(),
                }),
                id: s.string().key().identity(),
            }).compile();

            const entity = { id: "1", profile: { city: "NYC" } };
            const cloned = schema.clone(entity as InferType<typeof schema>);

            expect(cloned).toEqual(entity);
        });

        it("compiles when a date property is declared before the key", () => {
            const schema = s.define("dateFirst", {
                at: s.date(),
                id: s.string().key().identity(),
            }).compile();

            const deserialized = schema.deserialize({ id: "1", at: "2024-01-02T03:04:05.000Z" } as any);

            expect(deserialized.at).toBeInstanceOf(Date);
        });

        it("compiles when an optional object is declared before the key", () => {
            const schema = s.define("optionalObjectFirst", {
                metadata: s.object({
                    note: s.string(),
                }).optional(),
                id: s.string().key().identity(),
            }).compile();

            const enriched = schema.enrich({ id: "1" } as any, "diff");

            expect(enriched.id).toBe("1");
        });
    });

    describe("nullable object children", () => {
        const schema = s.define("nullableParent", {
            id: s.string().key(),
            details: s.object({
                note: s.string(),
            }).optional(),
        }).compile();

        type E = InferType<typeof schema>;

        it("compare does not throw when the object is absent", () => {
            const a = { id: "1" } as E;
            const b = { id: "1", details: { note: "x" } } as E;

            expect(schema.compare(a, a)).toBe(true);
            expect(schema.compare(a, b)).toBe(false);
        });

        it("hash does not throw when the object is absent", () => {
            expect(() => schema.hash({ id: "1" } as any, HashType.Object)).not.toThrow();
        });

        it("enrich does not throw when the object is absent", () => {
            const enriched = schema.enrich({ id: "1" } as any, "diff");

            expect(enriched.id).toBe("1");
        });
    });

    describe("clone value isolation", () => {
        it("preserves optional arrays", () => {
            const schema = s.define("optionalArray", {
                id: s.string().key(),
                tags: s.array(s.string()).optional(),
            }).compile();

            const entity = { id: "1", tags: ["a", "b"] };
            const cloned = schema.clone(entity as InferType<typeof schema>);

            expect(cloned.tags).toEqual(["a", "b"]);
            expect(cloned.tags).not.toBe(entity.tags);
        });

        it("copies dates by value", () => {
            const schema = s.define("withDate", {
                id: s.string().key(),
                at: s.date(),
            }).compile();

            const entity = { id: "1", at: new Date("2024-01-02T03:04:05.000Z") };
            const cloned = schema.clone(entity as InferType<typeof schema>);

            expect(cloned.at).not.toBe(entity.at);
            expect(cloned.at.getTime()).toBe(entity.at.getTime());

            cloned.at.setFullYear(1999);
            expect(entity.at.getFullYear()).toBe(2024);
        });

        it("does not share array element references", () => {
            const schema = s.define("arrayOfObjects", {
                id: s.string().key(),
                items: s.array(s.object({ sku: s.string() })),
            }).compile();

            const entity = { id: "1", items: [{ sku: "x" }] } as any;
            const cloned = schema.clone(entity as InferType<typeof schema>);

            expect(cloned.items).toEqual(entity.items);
            expect(cloned.items[0]).not.toBe(entity.items[0]);
        });
    });

    describe("enrichment defaults", () => {
        it("applies a literal default when the value is missing", () => {
            const schema = s.define("literalDefault", {
                id: s.string().key(),
                status: s.string().default("pending"),
            }).compile();

            const enriched = schema.enrich({ id: "1" } as any, "diff");

            expect(enriched.status).toBe("pending");
        });

        it("does not overwrite a provided value with the literal default", () => {
            const schema = s.define("literalDefaultProvided", {
                id: s.string().key(),
                status: s.string().default("pending"),
            }).compile();

            const enriched = schema.enrich({ id: "1", status: "done" } as any, "diff");

            expect(enriched.status).toBe("done");
        });

        it("applies a literal default on a nested property", () => {
            const schema = s.define("nestedDefault", {
                id: s.string().key(),
                config: s.object({
                    mode: s.string().default("auto"),
                }),
            }).compile();

            const enriched = schema.enrich({ id: "1", config: {} } as any, "diff");

            expect(enriched.config.mode).toBe("auto");
        });
    });

    describe("merge", () => {
        it("merges nested object values into a destination without the parent", () => {
            const schema = s.define("mergeNested", {
                id: s.string().key(),
                profile: s.object({
                    city: s.string(),
                }),
            }).compile();

            type E = InferType<typeof schema>;
            const destination = { id: "1" } as E;
            const source = { id: "1", profile: { city: "LA" } } as E;

            schema.merge(destination, source);

            expect(destination.profile.city).toBe("LA");
        });
    });

    describe("hash", () => {
        it("distinguishes arrays with different object elements", () => {
            const schema = s.define("hashArrays", {
                id: s.string().key(),
                items: s.array(s.object({ sku: s.string() })),
            }).compile();

            const a = schema.hash({ id: "1", items: [{ sku: "x" }] } as any, HashType.Object);
            const b = schema.hash({ id: "1", items: [{ sku: "y" }] } as any, HashType.Object);

            expect(a).not.toBe(b);
        });
    });

    describe("from() renames (storage name <-> property name)", () => {
        it("serializes a renamed root property to its storage name and round-trips", () => {
            const schema = s.define("rootRename", {
                id: s.string().key(),
                city: s.string().from("c"),
            }).compile();

            const serialized = schema.serialize({ id: "1", city: "NYC" } as any) as Record<string, unknown>;

            expect(serialized.c).toBe("NYC");
            expect(serialized.city).toBeUndefined();

            const deserialized = schema.deserialize({ id: "1", c: "NYC" } as any) as Record<string, unknown>;

            expect(deserialized.city).toBe("NYC");
            expect(deserialized.c).toBeUndefined();
        });

        it("compiles and round-trips a renamed nested property", () => {
            const schema = s.define("nestedRename", {
                id: s.string().key(),
                profile: s.object({
                    city: s.string().from("c"),
                }),
            }).compile();

            const serialized = schema.serialize({ id: "1", profile: { city: "NYC" } } as any) as any;

            expect(serialized.profile.c).toBe("NYC");
            expect(serialized.profile.city).toBeUndefined();

            const deserialized = schema.deserialize({ id: "1", profile: { c: "NYC" } } as any) as any;

            expect(deserialized.profile.city).toBe("NYC");
        });

        it("round-trips a renamed date property", () => {
            const schema = s.define("dateRename", {
                id: s.string().key(),
                createdAt: s.date().from("created_at"),
            }).compile();

            const at = new Date("2024-01-02T03:04:05.000Z");
            const serialized = schema.serialize({ id: "1", createdAt: at } as any) as Record<string, unknown>;

            expect(serialized.created_at).toBe("2024-01-02T03:04:05.000Z");
            expect(serialized.createdAt).toBeUndefined();

            const deserialized = schema.deserialize({ id: "1", created_at: "2024-01-02T03:04:05.000Z" } as any) as Record<string, unknown>;

            expect(deserialized.createdAt).toBeInstanceOf(Date);
            expect((deserialized.createdAt as Date).getTime()).toBe(at.getTime());
        });

        it("prepare emits storage names for renamed properties", () => {
            const schema = s.define("prepareRename", {
                id: s.string().key(),
                city: s.string().from("c"),
            }).compile();

            const prepared = schema.prepare({ id: "1", city: "NYC" } as any) as Record<string, unknown>;

            expect(prepared.c).toBe("NYC");
            expect(prepared.city).toBeUndefined();
        });
    });

    describe("functions and computed properties", () => {
        const schema = s.define("withModifiers", {
            id: s.string().key(),
            name: s.string(),
        }).modify(x => ({
            label: x.computed((entity) => `label-${(entity as { name: string }).name}`),
            up: x.function((entity) => () => (entity as { name: string }).name.toUpperCase()),
        })).compile();

        it("compare treats two enrichments of the same entity as equal", () => {
            const first = schema.enrich({ id: "1", name: "a" } as any, "diff");
            const second = schema.enrich({ id: "1", name: "a" } as any, "diff");

            expect(schema.compare(first as any, second as any)).toBe(true);
        });

        it("strip removes functions and unmapped computed properties", () => {
            const enriched = schema.enrich({ id: "1", name: "a" } as any, "diff");
            const stripped = schema.strip(enriched as any) as Record<string, unknown>;

            expect(stripped.name).toBe("a");
            expect(stripped.up).toBeUndefined();
            expect(stripped.label).toBeUndefined();
        });
    });
});
