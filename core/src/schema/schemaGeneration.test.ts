import { describe, expect, it } from '@jest/globals';
import { s } from './builder';
import { PropertyInfo } from './PropertyInfo';
import { SchemaError } from '../errors';

describe("Schema Generation", () => {
    const getProperty = (schema: { properties: PropertyInfo<any>[] }, id: string): PropertyInfo<any> | undefined => {
        return schema.properties.find((p) => p.id === id);
    };

    describe("best-practice structure", () => {
        it("keeps tests capability-focused (shape, behavior, and invalid usage)", () => {
            // This anchors the intended architecture of this file:
            // 1) support matrix for allowed schema shapes
            // 2) runtime behavior for compiled schema operations
            // 3) explicit invalid-usage guards
            expect(true).toBe(true);
        });
    });

    describe("support matrix", () => {
        it("compiles primitive properties and common modifiers", () => {
            const schema = s.define("simple", {
                id: s.string().key(),
                name: s.string(),
                age: s.number().optional(),
                active: s.boolean().default(() => true),
                createdAt: s.date().nullable(),
            }).compile();

            expect(schema.collectionName).toBe("simple");
            expect(schema.properties.length).toBeGreaterThan(0);
            expect(typeof schema.createSubscription).toBe("function");

            expect(getProperty(schema, "id")?.isKey).toBe(true);
            expect(getProperty(schema, "age")?.isOptional).toBe(true);
            expect(getProperty(schema, "active")?.defaultValue).toBeDefined();
            expect(getProperty(schema, "createdAt")?.isNullable).toBe(true);
        });

        it("supports objects up to two levels deep", () => {
            const schema = s.define("twoLevelObject", {
                id: s.string().key(),
                profile: s.object({
                    firstName: s.string(),
                    address: s.object({
                        city: s.string(),
                        state: s.string(),
                    }),
                }),
            });
            const compiled = schema.compile();

            // Root level object + nested level-2 properties
            expect(getProperty(compiled, "profile")?.type).toBe("Object");
            expect(getProperty(compiled, "profile.firstName")).toBeDefined();
            expect(getProperty(compiled, "profile.address")).toBeDefined();
            expect(getProperty(compiled, "profile.address.city")).toBeDefined();
            expect(getProperty(compiled, "profile.address.state")).toBeDefined();
        });

        it("supports arrays of objects", () => {
            const schema = s.define("arrayOfObjects", {
                id: s.string().key(),
                items: s.object({
                    sku: s.string(),
                    qty: s.number(),
                }).array(),
            }).compile();

            const items = getProperty(schema, "items");
            expect(items?.type).toBe("Array");
            expect(items?.innerSchema).toBeDefined();
        });
    });

    describe("compiled runtime behavior", () => {
        it("deserializes values with callback-based deserializer", () => {
            const schema = s.define("deserializer", {
                id: s.string().key(),
                createdAt: s.date().deserialize((x) => new Date(x))
            }).compile();

            const deserialized = schema.deserialize({
                id: "1",
                createdAt: "2020-01-02T00:00:00.000Z"
            } as never);

            expect(deserialized.createdAt).toBeInstanceOf(Date);
        });

        it("compareIds() is true for equivalent ids and false for different ids", () => {
            const schema = s.define("compareIds", {
                id: s.string().key(),
                name: s.string()
            }).compile();

            expect(schema.compareIds({ id: "1", name: "A" }, { id: "1", name: "B" })).toBe(true);
            expect(schema.compareIds({ id: "1", name: "A" }, { id: "2", name: "A" })).toBe(false);
        });
    });

    describe("metadata support", () => {
        it("attaches metadata when passed to compile(metadata)", () => {
            const metadata = {
                sync: { endpoint: "/api/products", retries: 3 },
                ui: { label: "Products" }
            } as const;

            const schema = s.define("withMetadata", {
                id: s.string().key(),
                name: s.string()
            }).compile(metadata);

            expect(schema.metadata).toEqual(metadata);
        });

        it("compile() and compile(metadata) return different schema shapes", () => {
            const definition = s.define("metadataShape", {
                id: s.string().key(),
                name: s.string()
            });

            const withoutMetadata = definition.compile();
            const withMetadata = definition.compile({ api: "/users" });

            expect(withoutMetadata).not.toBe(withMetadata);
            expect((withoutMetadata as any).metadata).toBeUndefined();
            expect((withMetadata as any).metadata).toEqual({ api: "/users" });
        });
    });

    describe("compile edge cases", () => {
        it("throws SchemaError when no key is defined", () => {
            expect(() => s.define("missingKey", {
                name: s.string()
            }).compile()).toThrow(SchemaError);
        });

        it("compile() returns a fresh instance on each call", () => {
            const definition = s.define("freshCompile", {
                id: s.string().key(),
                value: s.number()
            });

            const first = definition.compile();
            const second = definition.compile();
            expect(first).not.toBe(second);
        });
    });

    describe("invalid callback styles", () => {
        it("throws when using function keyword in schema callback parameters", () => {
            expect(() => s.define("functionKeywordDefault", {
                id: s.string().key(),
                createdAt: s.date().default(function () { return new Date("2020-01-01T00:00:00.000Z"); })
            }).compile()).toThrow("Only arrow functions are allowed in the schema definition");
        });

        it("allows arrow functions with block bodies and return keyword", () => {
            const schema = s.define("blockBodyAllowed", {
                id: s.string().key(),
                createdAt: s.date().deserialize((x) => { return new Date(x); })
            }).compile();

            const result = schema.deserialize({
                id: "2",
                createdAt: "2020-01-02T00:00:00.000Z"
            } as never);

            expect(result.createdAt).toBeInstanceOf(Date);
        });
    });
});