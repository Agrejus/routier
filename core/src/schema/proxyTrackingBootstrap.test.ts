import { types } from "node:util";
import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

type Tracking = {
    changes: Record<string, unknown>;
    original: Record<string, unknown>;
    isDirty: boolean;
    isPaused: boolean;
    raw?: object;
};

type Enrichable = {
    postprocess: (record: never, mode: "proxy" | "diff") => object;
    merge: (destination: never, source: never) => object;
};

type Case = [string, Enrichable, object];

const trackingOf = (entity: object): Tracking | undefined => Object.getOwnPropertyDescriptor(entity, "__tracking__")?.value;

const base = {
    id: s.string().key(),
    name: s.string(),
    count: s.number(),
};

const record = { id: "a", name: "before", count: 1 };

const cases: Case[] = [
    ["only plain primitives", s.define("bootstrap_plain", base).compile(), record],
    ["a root value default", s.define("bootstrap_default", { ...base, label: s.string().default("fallback") }).compile(), record],
    ["a root function default", s.define("bootstrap_default_fn", { ...base, stamp: s.number().default(() => 5) }).compile(), record],
    ["renamed properties", s.define("bootstrap_renamed", { id: s.string().key().from("pk"), name: s.string().from("wire_name"), count: s.number() }).compile(), { pk: "a", wire_name: "before", count: 1 }],
    ["a serializer", s.define("bootstrap_serializer", { ...base, coded: s.number().serialize(value => `N${value}`).deserialize(value => Number(String(value).slice(1))) }).compile(), { ...record, coded: "N3" }],
    ["nullable and optional values", s.define("bootstrap_nullable", { ...base, note: s.string().nullable(), maybe: s.string().optional() }).compile(), { ...record, note: null }],
    ["an identity key", s.define("bootstrap_identity", { id: s.number().key().identity(), name: s.string(), count: s.number() }).compile(), { id: 1, name: "before", count: 1 }],
    ["a composite key", s.define("bootstrap_composite", { id: s.string().key(), part: s.number().key(), name: s.string(), count: s.number() }).compile(), { ...record, part: 2 }],
    ["a date", s.define("bootstrap_date", { ...base, when: s.date() }).compile(), { ...record, when: "2020-01-02T03:04:05.000Z" }],
    ["an array", s.define("bootstrap_array", { ...base, tags: s.array(s.string()) }).compile(), { ...record, tags: ["x"] }],
    ["computed and function properties", s.define("bootstrap_computed", base).modify(x => ({
        upper: x.computed(entity => entity.name.toUpperCase()),
        stored: x.computed(entity => `${entity.name}!`).tracked(),
        greet: x.function(entity => (greeting: string) => `${greeting} ${entity.name}`),
    })).compile(), record],
    ["a nested object", s.define("bootstrap_nested", { ...base, nested: s.object({ value: s.string() }) }).compile(), { ...record, nested: { value: "v" } }],
    ["an object two levels deep", s.define("bootstrap_deep", { ...base, nested: s.object({ inner: s.object({ value: s.number() }) }) }).compile(), { ...record, nested: { inner: { value: 1 } } }],
    ["a default inside a nested object", s.define("bootstrap_nested_default", { ...base, nested: s.object({ value: s.string().default("d") }) }).compile(), { ...record, nested: {} }],
    ["an array of objects inside an object", s.define("bootstrap_nested_array", { ...base, nested: s.object({ items: s.object({ label: s.string() }).array() }) }).compile(), { ...record, nested: { items: [{ label: "l" }] } }],
];

const enrich = (schema: Enrichable, stored: object) => schema.postprocess(structuredClone(stored) as never, "proxy");

describe.each(cases)("proxy enrichment of a schema with %s", (_label, schema, stored) => {
    it("returns a proxy carrying an empty, non-enumerable tracking slot", () => {
        const entity = enrich(schema, stored);
        const descriptor = Object.getOwnPropertyDescriptor(entity, "__tracking__");

        expect(Reflect.get(entity, "__isProxy__")).toBe(true);
        expect(descriptor).toEqual({ value: undefined, writable: true, enumerable: false, configurable: true });
    });

    it("keeps the tracking slot out of the entity's keys and JSON", () => {
        const entity = enrich(schema, stored);

        expect(Object.keys(entity)).not.toContain("__tracking__");
        expect(JSON.stringify(entity)).not.toContain("__tracking__");
    });

    it("records a root write with the original value and the unproxied entity", () => {
        const entity = enrich(schema, stored);

        Reflect.set(entity, "name", "after");
        const tracking = trackingOf(entity);

        expect(tracking?.changes).toEqual({ name: "after" });
        expect(tracking?.original).toEqual({ name: "before" });
        expect(tracking?.isDirty).toBe(true);
        expect(tracking?.isPaused).toBe(false);
        expect(tracking?.raw).not.toBe(entity);
        expect(Reflect.get(tracking?.raw ?? {}, "__isProxy__")).toBeUndefined();
        expect(Reflect.get(tracking?.raw ?? {}, "name")).toBe("after");
    });

    it("is clean again once every changed value is set back to its original", () => {
        const entity = enrich(schema, stored);

        Reflect.set(entity, "name", "after");
        Reflect.set(entity, "count", 2);
        Reflect.set(entity, "name", "before");

        expect(trackingOf(entity)?.isDirty).toBe(true);
        expect(trackingOf(entity)?.changes).toEqual({ count: 2 });

        Reflect.set(entity, "count", 1);

        expect(trackingOf(entity)?.isDirty).toBe(false);
        expect(trackingOf(entity)?.changes).toEqual({});
        expect(trackingOf(entity)?.original).toEqual({});
    });

    it("merges a re-read copy in without recording a change", () => {
        const entity = enrich(schema, stored);
        const reread = schema.postprocess(structuredClone(stored) as never, "diff");
        Reflect.set(reread, "count", 9);

        schema.merge(entity as never, reread as never);

        expect(Reflect.get(entity, "count")).toBe(9);
        expect(trackingOf(entity)?.isDirty ?? false).toBe(false);
        expect(Object.hasOwn(entity, "__tracking__")).toBe(false);

        Reflect.set(entity, "name", "after");

        expect(trackingOf(entity)?.changes).toEqual({ name: "after" });
    });

    it("keeps the pending changes of a dirty entity through a merge and tracks writes after it", () => {
        const entity = enrich(schema, stored);
        Reflect.set(entity, "name", "after");
        const reread = schema.postprocess(structuredClone(stored) as never, "diff");
        Reflect.set(reread, "count", 9);

        schema.merge(entity as never, reread as never);

        expect(Reflect.get(entity, "count")).toBe(9);
        expect(trackingOf(entity)?.changes).toEqual({ name: "after" });
        expect(trackingOf(entity)?.isDirty).toBe(true);
        expect(trackingOf(entity)?.isPaused).toBe(false);

        Reflect.set(entity, "count", 10);

        expect(trackingOf(entity)?.changes).toEqual({ name: "after", count: 10 });
        expect(trackingOf(entity)?.original).toEqual({ name: "before", count: 9 });
    });

    it("leaves no tracking behind when merging into an untracked entity", () => {
        const destination = schema.postprocess(structuredClone(stored) as never, "diff");
        const reread = schema.postprocess(structuredClone(stored) as never, "diff");
        Reflect.set(reread, "count", 9);

        schema.merge(destination as never, reread as never);

        expect(Reflect.get(destination, "count")).toBe(9);
        expect(Object.hasOwn(destination, "__tracking__")).toBe(false);
    });
});

describe("tracking writes below the root", () => {
    const schema = s.define("bootstrap_below_root", {
        id: s.string().key(),
        nested: s.object({ inner: s.object({ value: s.number() }), label: s.string() }),
    }).compile();

    const enriched = () => schema.postprocess({ id: "a", nested: { inner: { value: 1 }, label: "l" } } as never, "proxy");

    it("records a nested write on the root under its dotted path", () => {
        const entity = enriched();

        entity.nested.inner.value = 2;

        expect(trackingOf(entity)?.changes).toEqual({ "nested.inner.value": 2 });
        expect(trackingOf(entity)?.original).toEqual({ "nested.inner.value": 1 });
        expect(Object.hasOwn(entity.nested.inner, "__tracking__")).toBe(false);
        expect(Object.hasOwn(entity.nested, "__tracking__")).toBe(false);
    });

    it("names the root's unproxied entity when a nested write bootstraps tracking", () => {
        const entity = enriched();

        entity.nested.label = "m";

        const raw = trackingOf(entity)?.raw;

        expect(types.isProxy(raw)).toBe(false);
        expect(Reflect.get(raw ?? {}, "id")).toBe("a");
    });

    it("keeps the unproxied entity out of the tracking record's enumerable shape", () => {
        const entity = enriched();

        entity.id = "b";

        expect(Object.keys(trackingOf(entity) ?? {}).sort()).toEqual(["changes", "isDirty", "isPaused", "original"]);
    });

    it("names the root's unproxied entity when the root bootstraps tracking", () => {
        const entity = enriched();

        entity.id = "b";
        entity.nested.label = "m";

        expect(Reflect.get(trackingOf(entity)?.raw ?? {}, "id")).toBe("b");
        expect(trackingOf(entity)?.changes).toEqual({ id: "b", "nested.label": "m" });
    });
});

describe("tracking created lazily by the first write", () => {
    const schema = s.define("bootstrap_lazy", { id: s.string().key(), name: s.string() }).compile();

    const tracked = () => schema.enableChangeTracking({ id: "a", name: "before" });

    it("installs the tracking record as a writable, configurable, non-enumerable property", () => {
        const entity = tracked();

        entity.name = "after";

        expect(Object.getOwnPropertyDescriptor(entity, "__tracking__")).toMatchObject({ writable: true, enumerable: false, configurable: true });
    });

    it("drops a write to the tracking slot itself, leaving a clean record behind", () => {
        const entity = tracked();

        Reflect.set(entity, "__tracking__", { changes: { name: "forged" }, isDirty: true, original: {}, isPaused: true });

        expect(trackingOf(entity)).toEqual({ changes: {}, isDirty: false, original: {}, isPaused: false });
        expect(trackingOf(entity)?.raw).toEqual({ id: "a", name: "before" });
    });

    it("applies a write made while tracking is paused without recording it", () => {
        const entity = tracked();
        entity.name = "after";
        const tracking = trackingOf(entity);
        if (tracking != null) {
            tracking.isPaused = true;
        }

        entity.name = "paused";

        expect(entity.name).toBe("paused");
        expect(tracking?.changes).toEqual({ name: "after" });
    });
});
