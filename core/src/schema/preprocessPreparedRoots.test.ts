import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

type Pipeline = {
    preprocess: (entity: never) => object;
    prepare: (entity: never) => object;
    serialize: (entity: never) => object;
};

type Case = [string, Pipeline, object[]];

const separatelyPreparedThenSerialized = (schema: Pipeline, entity: object) => ({
    ...schema.prepare(entity as never),
    ...schema.serialize(entity as never),
});

const cases: Case[] = [
    ["plain primitives", s.define("prepared_plain", {
        id: s.string().key(),
        name: s.string(),
        count: s.number(),
        flag: s.boolean(),
    }).compile(), [
        { id: "a", name: "n", count: 0, flag: false },
        { id: "a", name: "", count: 1, flag: true },
        { id: "a" },
    ]],
    ["renamed properties", s.define("prepared_renamed", {
        id: s.string().key().from("pk"),
        name: s.string().from("wire_name"),
    }).compile(), [
        { id: "a", name: "n" },
        { id: "a" },
    ]],
    ["serializers", s.define("prepared_serializers", {
        id: s.string().key(),
        count: s.number().serialize(value => `N${value}`).deserialize(value => Number(String(value).slice(1))),
        plain: s.string(),
    }).compile(), [
        { id: "a", count: 7, plain: "p" },
        { id: "a", count: null, plain: null },
    ]],
    ["defaults", s.define("prepared_defaults", {
        id: s.string().key(),
        label: s.string().default("fallback"),
        computedDefault: s.number().default(() => 5),
    }).compile(), [
        { id: "a", label: "given", computedDefault: 1 },
        { id: "a" },
    ]],
    ["nullable and optional values", s.define("prepared_nullable", {
        id: s.string().key(),
        note: s.string().nullable(),
        maybe: s.string().optional(),
        both: s.number().nullable().optional(),
    }).compile(), [
        { id: "a", note: null, maybe: "m", both: null },
        { id: "a", note: "n" },
    ]],
    ["an identity key", s.define("prepared_identity_key", {
        id: s.number().key().identity(),
        name: s.string(),
    }).compile(), [
        { id: 1, name: "n" },
        { id: null, name: "n" },
        { name: "n" },
    ]],
    ["a composite key", s.define("prepared_composite", {
        tenant: s.string().key(),
        code: s.number().key(),
        name: s.string(),
    }).compile(), [
        { tenant: "t", code: 1, name: "n" },
        { tenant: null, code: null, name: "n" },
        { name: "n" },
    ]],
    ["an identity that is not a key", s.define("prepared_identity_value", {
        id: s.string().key(),
        sequence: s.number().identity(),
        name: s.string(),
    }).compile(), [
        { id: "a", sequence: 3, name: "n" },
        { id: "a", sequence: null, name: "n" },
        { id: "a", name: "n" },
    ]],
    ["nested objects and arrays", s.define("prepared_nested", {
        id: s.string().key(),
        name: s.string(),
        nested: s.object({ value: s.string().from("wire_value"), inner: s.object({ deep: s.number() }) }),
        tags: s.array(s.string()),
        items: s.object({ label: s.string() }).array(),
    }).compile(), [
        { id: "a", name: "n", nested: { value: "v", inner: { deep: 1 } }, tags: ["x"], items: [{ label: "l" }] },
        { id: "a", nested: { value: "v", inner: { deep: 1 } }, tags: [], items: [] },
    ]],
    ["dates", s.define("prepared_dates", {
        id: s.string().key(),
        when: s.date(),
        maybeWhen: s.date().nullable().optional(),
    }).compile(), [
        { id: "a", when: new Date("2020-01-02T03:04:05.000Z"), maybeWhen: null },
        { id: "a", when: new Date("2020-01-02T03:04:05.000Z"), maybeWhen: new Date("2021-01-01T00:00:00.000Z") },
    ]],
    ["computed and function properties", s.define("prepared_computed", {
        id: s.string().key(),
        name: s.string(),
    }).modify(x => ({
        upper: x.computed(entity => entity.name.toUpperCase()),
        stored: x.computed(entity => `${entity.name}!`).tracked(),
        greet: x.function(entity => (greeting: string) => `${greeting} ${entity.name}`),
    })).compile(), [
        { id: "a", name: "n", upper: "N", stored: "n!" },
        { id: "a", name: "n" },
    ]],
];

describe("preprocess on schemas whose plain root values are already prepared", () => {
    describe.each(cases)("with %s", (_label, schema, entities) => {
        it.each(entities.map((entity): [string, object] => [JSON.stringify(entity), entity]))("matches prepare followed by serialize for %s", (_json, entity) => {
            expect(schema.preprocess(entity as never)).toStrictEqual(separatelyPreparedThenSerialized(schema, entity));
        });
    });

    it("reads each plain root value from the entity exactly once", () => {
        const schema = s.define("prepared_reads", {
            id: s.string().key(),
            name: s.string(),
            count: s.number(),
        }).compile();
        const reads: string[] = [];
        const entity = {
            id: "a",
            get name() { reads.push("name"); return "n"; },
            get count() { reads.push("count"); return 1; },
        };

        expect(schema.preprocess(entity as never)).toStrictEqual({ id: "a", name: "n", count: 1 });
        expect(reads.sort()).toEqual(["count", "name"]);
    });

    it("keeps an explicit null key, which prepare alone would drop", () => {
        const schema = s.define("prepared_null_key", { id: s.string().key(), name: s.string() }).compile();

        expect(schema.preprocess({ id: null, name: "n" } as never)).toStrictEqual({ id: null, name: "n" });
    });

    it("keeps an explicit null identity, which prepare alone would drop", () => {
        const schema = s.define("prepared_null_identity", { id: s.string().key(), sequence: s.number().identity(), name: s.string() }).compile();

        expect(schema.preprocess({ id: "a", sequence: null, name: "n" } as never)).toStrictEqual({ id: "a", sequence: null, name: "n" });
    });
});
