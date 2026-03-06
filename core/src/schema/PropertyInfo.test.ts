import { describe, expect, it } from "@jest/globals";
import { s } from "./builder";
import { SchemaTypes } from "./types";

const testSchema = s.define("test", {
    id: s.string().key(),
    testProperty: s.string(),
    nullableProperty: s.string().nullable(),
    optionalProperty: s.string().optional(),
    parentProperty: s.object({
        childProperty: s.string(),
        identityChild: s.string().identity(),
    }),
    grandparentProperty: s.object({
        parentProperty: s.object({
            childProperty: s.string(),
        }),
    }),
    nullableParentProperty: s.object({
        childProperty: s.string(),
    }).nullable(),
    remappedProperty: s.string().from("db_test_property"),
    numberProperty: s.number(),
    booleanProperty: s.boolean(),
    dateProperty: s.date(),
    unsupportedArray: s.array(s.string()),
}).compile();

const properties = testSchema.properties;
const getProperty = (id: string) => properties.find((p) => p.id === id)!;

const baseProperty = getProperty("testProperty");
const nullableProperty = getProperty("nullableProperty");
const optionalProperty = getProperty("optionalProperty");
const nestedChildProperty = getProperty("parentProperty.childProperty");
const deepChildProperty = getProperty("grandparentProperty.parentProperty.childProperty");
const nullableParentChildProperty = getProperty("nullableParentProperty.childProperty");
const parentProperty = getProperty("parentProperty");
const remappedProperty = getProperty("remappedProperty");

const fastHash = (value: string) => `hash:${value.length}`;
const isNullOrEmpty = (value: unknown) => value == null || value === "";

const memoryInspiredSchema = s.define("memoryInspired", {
    numericId: s.number().key().identity(),
    revision: s.string().identity(),
    orderId: s.string().key().from("_id").identity(),
    status: s.string("pending", "processing", "shipped", "delivered", "cancelled"),
    tags: s.string("computer", "accessory").array(),
    isSuperAdmin: s.boolean().default(false),
    namedByDefault: s.string().default((deps: { name: string }) => deps.name, { name: "James" }),
    createdAt: s.date().default(() => new Date("2024-01-01T00:00:00.000Z")).deserialize((x) => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(String(x))),
    metadataJson: s.object({
        email: s.string().optional(),
    }).optional(),
    maybeTime: s.number().nullable().default(() => null),
}).modify((w) => ({
    documentType: w.computed((_, collectionName) => collectionName).tracked(),
    createdDate: w.computed((entity) => new Date(entity.createdAt)),
    hasCollectionName: w.computed((_, collectionName, injected) => !injected.isNullOrEmpty(collectionName), { isNullOrEmpty }).tracked(),
    getDisplayName: w.function((entity) => (format: "short" | "full") => format === "short" ? entity.status : `${entity.orderId}:${entity.status}`),
    hashId: w.computed((entity, _, deps) => deps.fastHash(JSON.stringify(entity)), { fastHash }).tracked().key(),
})).compile();

const memoryProperties = memoryInspiredSchema.properties;
const getMemoryProperty = (id: string) => memoryProperties.find((p) => p.id === id)!;

describe("PropertyInfo", () => {
    describe("constructor and basic properties", () => {
        it("should create PropertyInfo with correct basic properties", () => {
            expect(baseProperty.name).toBe("testProperty");
            expect(baseProperty.type).toBe(SchemaTypes.String);
            expect(baseProperty.isNullable).toBe(false);
            expect(baseProperty.isOptional).toBe(false);
            expect(baseProperty.isKey).toBe(false);
            expect(baseProperty.isIdentity).toBe(false);
            expect(baseProperty.isReadonly).toBe(false);
            expect(baseProperty.isUnmapped).toBe(false);
            expect(baseProperty.isDistinct).toBe(false);
            expect(baseProperty.indexes).toEqual([]);
            expect(baseProperty.injected).toBeNull();
            expect(baseProperty.defaultValue).toBeNull();
            expect(baseProperty.valueSerializer).toBeNull();
            expect(baseProperty.valueDeserializer).toBeNull();
            expect(baseProperty.functionBody).toBeUndefined();
            expect(baseProperty.children).toEqual([]);
            expect(baseProperty.parent).toBeNull();
            expect(baseProperty.literals).toEqual([]);
        });

        it("should expose nullable and optional flags from schema", () => {
            expect(nullableProperty.isNullable).toBe(true);
            expect(nullableProperty.isOptional).toBe(false);
            expect(optionalProperty.isNullable).toBe(false);
            expect(optionalProperty.isOptional).toBe(true);
        });

        it("should expose parent relationship for nested property", () => {
            expect(nestedChildProperty.parent).toBe(parentProperty);
            expect(nestedChildProperty.name).toBe("childProperty");
        });
    });

    describe("id and level", () => {
        it("should expose id path values", () => {
            expect(baseProperty.id).toBe("testProperty");
            expect(nestedChildProperty.id).toBe("parentProperty.childProperty");
            expect(deepChildProperty.id).toBe("grandparentProperty.parentProperty.childProperty");
        });

        it("should expose level values", () => {
            expect(baseProperty.level).toBe(0);
            expect(nestedChildProperty.level).toBe(1);
            expect(deepChildProperty.level).toBe(2);
        });
    });

    describe("path array helpers", () => {
        it("should return full path arrays", () => {
            expect(baseProperty.getPathArray()).toEqual(["testProperty"]);
            expect(nestedChildProperty.getPathArray()).toEqual(["parentProperty", "childProperty"]);
            expect(deepChildProperty.getPathArray()).toEqual(["grandparentProperty", "parentProperty", "childProperty"]);
        });

        it("should return parent path arrays", () => {
            expect(baseProperty.getParentPathArray()).toEqual([]);
            expect(nestedChildProperty.getParentPathArray()).toEqual(["parentProperty"]);
            expect(deepChildProperty.getParentPathArray()).toEqual(["grandparentProperty", "parentProperty"]);
        });
    });

    describe("parent/child traits", () => {
        it("hasNullableParents should use real parent optionality", () => {
            expect(baseProperty.hasNullableParents).toBe(false);
            expect(nullableParentChildProperty.hasNullableParents).toBe(true);
            expect(nestedChildProperty.hasNullableParents).toBe(false);
        });

        it("hasIdentityChildren should detect recursive identity children", () => {
            expect(baseProperty.hasIdentityChildren).toBe(false);
            expect(parentProperty.hasIdentityChildren).toBe(true);
        });
    });

    describe("getValue and setValue", () => {
        it("getValue should support nullish short-circuit and nested lookup", () => {
            expect(baseProperty.getValue(null as any)).toBeNull();
            expect(baseProperty.getValue(undefined as any)).toBeNull();
            expect(baseProperty.getValue({ testProperty: "testValue" })).toBe("testValue");
            expect(nestedChildProperty.getValue({ parentProperty: { childProperty: "nestedValue" } } as any)).toBe("nestedValue");
            expect(nestedChildProperty.getValue({ parentProperty: null } as any)).toBeNull();
            expect(nestedChildProperty.getValue({ parentProperty: undefined } as any)).toBeNull();
        });

        it("setValue should write paths and create intermediates", () => {
            const root: any = {};
            baseProperty.setValue(root, "newValue");
            expect(root).toEqual({ testProperty: "newValue" });

            const nested: any = {};
            nestedChildProperty.setValue(nested, "nestedValue");
            expect(nested).toEqual({ parentProperty: { childProperty: "nestedValue" } });

            const deep: any = {};
            deepChildProperty.setValue(deep, "deepValue");
            expect(deep).toEqual({ grandparentProperty: { parentProperty: { childProperty: "deepValue" } } });
        });

        it("setValue should throw for nullish instance", () => {
            expect(() => baseProperty.setValue(null as any, "value")).toThrow("Cannot set value on null or undefined instance");
            expect(() => baseProperty.setValue(undefined as any, "value")).toThrow("Cannot set value on null or undefined instance");
        });
    });

    describe("selector and assignment paths", () => {
        it("should produce selector paths", () => {
            expect(baseProperty.getSelectrorPath({ parent: "entity" })).toBe("entity.testProperty");
            expect(nestedChildProperty.getSelectrorPath({ parent: "entity" })).toBe("entity.parentProperty.childProperty");
            expect(nullableProperty.getSelectrorPath({ parent: "entity" })).toBe("entity?.nullableProperty");
            expect(optionalProperty.getSelectrorPath({ parent: "entity" })).toBe("entity?.optionalProperty");
            expect(nullableParentChildProperty.getSelectrorPath({ parent: "entity" })).toBe("entity?.nullableParentProperty.childProperty");
            expect(nullableProperty.getSelectrorPath({ parent: "entity", assignmentType: "ASSIGNMENT" })).toBe("entity.nullableProperty");
        });

        it("should produce assignment paths", () => {
            expect(baseProperty.getAssignmentPath()).toBe("testProperty");
            expect(nestedChildProperty.getAssignmentPath()).toBe("parentProperty.childProperty");
            expect(baseProperty.getAssignmentPath({ parent: "entity" })).toBe("entity.testProperty");
            expect(nestedChildProperty.getAssignmentPath({ parent: "entity" })).toBe("entity.parentProperty.childProperty");
            expect(nullableProperty.getAssignmentPath()).toBe("nullableProperty");
            expect(optionalProperty.getAssignmentPath()).toBe("optionalProperty");
        });

        it("should use remapped names for schema-represented properties", () => {
            expect(remappedProperty.getAssignmentPath({ useFromPropertyName: true })).toBe("db_test_property");
            expect(remappedProperty.getAssignmentPath({ parent: "entity", useFromPropertyName: true })).toBe("entity.db_test_property");
        });
    });

    describe("resolved names and deserialization support", () => {
        it("should resolve remapped and original names", () => {
            expect(remappedProperty.getResolvedName()).toBe("db_test_property");
            expect(baseProperty.getResolvedName()).toBe("testProperty");
        });

        it("should build selector path from remapped names", () => {
            expect(remappedProperty.getSelectrorPath({ parent: "entity", useFromPropertyName: true })).toBe("entity.db_test_property");
        });

        it("should report deserialization support", () => {
            expect(baseProperty.supportsDeserialization).toBe(true);
            expect(getProperty("numberProperty").supportsDeserialization).toBe(true);
            expect(getProperty("booleanProperty").supportsDeserialization).toBe(true);
            expect(getProperty("dateProperty").supportsDeserialization).toBe(true);
            expect(getProperty("unsupportedArray").supportsDeserialization).toBe(false);
            expect(getMemoryProperty("createdAt").supportsDeserialization).toBe(true);
        });
    });

    describe("memory plugin schema coverage", () => {
        it("should expose literal string values and array inner schemas", () => {
            const statusProperty = getMemoryProperty("status");
            const tagsProperty = getMemoryProperty("tags");

            expect(statusProperty.literals).toEqual(["pending", "processing", "shipped", "delivered", "cancelled"]);
            expect(tagsProperty.type).toBe(SchemaTypes.Array);
            expect(tagsProperty.innerSchema).toBeDefined();
            expect(tagsProperty.innerSchema?.literals).toEqual(["computer", "accessory"]);
        });

        it("should expose key identity and remapped identity combinations used by memory schemas", () => {
            const numericIdProperty = getMemoryProperty("numericId");
            const revisionProperty = getMemoryProperty("revision");
            const orderIdProperty = getMemoryProperty("orderId");

            expect(numericIdProperty.type).toBe(SchemaTypes.Number);
            expect(numericIdProperty.isKey).toBe(true);
            expect(numericIdProperty.isIdentity).toBe(true);

            expect(revisionProperty.isKey).toBe(false);
            expect(revisionProperty.isIdentity).toBe(true);

            expect(orderIdProperty.isKey).toBe(true);
            expect(orderIdProperty.isIdentity).toBe(true);
            expect(orderIdProperty.getResolvedName()).toBe("_id");
            expect(orderIdProperty.getAssignmentPath({ useFromPropertyName: true })).toBe("_id");
        });

        it("should expose literal and injected defaults from memory schemas", () => {
            const boolDefaultProperty = getMemoryProperty("isSuperAdmin");
            const injectedDefaultProperty = getMemoryProperty("namedByDefault");
            const nullableDefaultProperty = getMemoryProperty("maybeTime");

            expect(boolDefaultProperty.defaultValue).toBe(false);
            expect(injectedDefaultProperty.defaultValue).toBeDefined();
            expect(injectedDefaultProperty.injected).toEqual({ name: "James" });
            expect(nullableDefaultProperty.isNullable).toBe(true);
            expect(nullableDefaultProperty.defaultValue).toBeDefined();
        });

        it("should expose optional object parent behavior from memory schemas", () => {
            const metadataProperty = getMemoryProperty("metadataJson");
            const metadataEmailProperty = getMemoryProperty("metadataJson.email");

            expect(metadataProperty.isOptional).toBe(true);
            expect(metadataEmailProperty.parent).toBe(metadataProperty);
            expect(metadataEmailProperty.isOptional).toBe(true);
            expect(metadataEmailProperty.hasNullableParents).toBe(true);
            expect(metadataEmailProperty.getSelectrorPath({ parent: "entity" })).toBe("entity?.metadataJson?.email");
        });

        it("should expose date default and deserializer combinations used by memory schemas", () => {
            const createdAtProperty = getMemoryProperty("createdAt");

            expect(createdAtProperty.type).toBe(SchemaTypes.Date);
            expect(createdAtProperty.defaultValue).toBeDefined();
            expect(createdAtProperty.valueDeserializer).not.toBeNull();
            expect(createdAtProperty.supportsDeserialization).toBe(true);
        });

        it("should expose computed and function metadata from memory schemas", () => {
            const createdDateProperty = getMemoryProperty("createdDate");
            const documentTypeProperty = getMemoryProperty("documentType");
            const hasCollectionNameProperty = getMemoryProperty("hasCollectionName");
            const functionProperty = getMemoryProperty("getDisplayName");
            const hashIdProperty = getMemoryProperty("hashId");

            expect(createdDateProperty.type).toBe(SchemaTypes.Computed);
            expect(createdDateProperty.isUnmapped).toBe(true);
            expect(createdDateProperty.functionBody).toBeDefined();
            expect(createdDateProperty.injected).toBeUndefined();

            expect(documentTypeProperty.isUnmapped).toBe(false);
            expect(documentTypeProperty.type).toBe(SchemaTypes.Computed);

            expect(hasCollectionNameProperty.isUnmapped).toBe(false);
            expect(hasCollectionNameProperty.injected).toEqual({ isNullOrEmpty });

            expect(functionProperty.type).toBe(SchemaTypes.Function);
            expect(functionProperty.isUnmapped).toBe(true);
            expect(functionProperty.functionBody).toBeDefined();

            expect(hashIdProperty.type).toBe(SchemaTypes.Computed);
            expect(hashIdProperty.isKey).toBe(true);
            expect(hashIdProperty.isUnmapped).toBe(false);
            expect(hashIdProperty.injected).toEqual({ fastHash });
        });
    });
});