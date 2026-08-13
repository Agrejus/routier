import { describe, it, expect } from '@jest/globals';
import { s } from './index';

/**
 * `cloneStorage` copies a record that is still in the STORAGE shape.
 *
 * Stored records carry renamed properties under their `from` names. `clone` reads in-memory
 * names, so on such a record it reads `undefined` for every renamed property and drops it —
 * which is why this path used to fall back to `structuredClone`. These tests hold the generated
 * cloner to `structuredClone`'s semantics for the types a schema can declare, because that is
 * the behaviour it replaces.
 */
const schema = s.define("clone_storage", {
    id: s.string().key(),
    name: s.string().from("product_name"),
    price: s.number().from("unit_price"),
    when: s.date().from("created_at"),
    tags: s.array(s.string()).from("tag_list"),
    nested: s.object({ inner: s.string().from("inner_col") }).from("nested_col"),
    plain: s.string(),
    note: s.string().from("note_col").nullable(),
    maybe: s.string().from("maybe_col").optional(),
}).compile();

const record = (): Record<string, any> => ({
    id: "a",
    product_name: "Widget",
    unit_price: 9.99,
    created_at: new Date("2020-01-02T03:04:05.000Z"),
    tag_list: ["x", "y"],
    nested_col: { inner_col: "deep" },
    plain: "p",
    note_col: null,
});

describe("cloneStorage", () => {

    it("round-trips a storage-shape record identically to structuredClone", () => {
        const source = record();

        const generated = (schema as any).cloneStorage(source);
        const structural = structuredClone(source);

        expect(generated).toEqual(structural);
    });

    it("keeps every renamed property, which clone() cannot", () => {
        const cloned = (schema as any).cloneStorage(record());

        expect(cloned.product_name).toBe("Widget");
        expect(cloned.unit_price).toBe(9.99);
        expect(cloned.tag_list).toEqual(["x", "y"]);
        expect(cloned.nested_col).toEqual({ inner_col: "deep" });
    });

    it("copies properties that were never renamed under their own name", () => {
        const cloned = (schema as any).cloneStorage(record());

        expect(cloned.id).toBe("a");
        expect(cloned.plain).toBe("p");
    });

    it("deep-copies, so mutating the copy cannot reach the source", () => {
        const source = record();
        const cloned = (schema as any).cloneStorage(source);

        cloned.tag_list.push("z");
        cloned.nested_col.inner_col = "changed";
        cloned.created_at.setFullYear(1999);

        expect(source.tag_list).toEqual(["x", "y"]);
        expect(source.nested_col.inner_col).toBe("deep");
        expect(source.created_at.getFullYear()).toBe(2020);
    });

    it("copies a Date as a real Date carrying the same instant", () => {
        const source = record();
        const cloned = (schema as any).cloneStorage(source);

        expect(cloned.created_at).toBeInstanceOf(Date);
        expect(cloned.created_at.getTime()).toBe(source.created_at.getTime());
        expect(cloned.created_at).not.toBe(source.created_at);
    });

    // Same distinction CloneValueHandler draws for the in-memory cloner (known-defects #66):
    // an explicit null is a value and survives; an absent property is not invented.
    it("preserves an explicit null and omits an absent property", () => {
        const cloned = (schema as any).cloneStorage(record());

        expect(cloned.note_col).toBeNull();
        expect(Object.hasOwn(cloned, "maybe_col")).toBe(false);
    });

    /**
     * ConcurrencyDbPlugin appends a synthetic `__version` property with a `from` name for the
     * express purpose of routing reads onto this cloner, so its hidden column survives the copy
     * and the wrapper can observe the row's version. Dropping undeclared columns here makes every
     * read look unversioned and optimistic concurrency stops detecting conflicts — silently.
     */
    it("carries columns the schema never declared, which structuredClone did too", () => {
        const source = { ...record(), __version: 7 };

        const cloned = (schema as any).cloneStorage(source);

        expect(cloned.__version).toBe(7);
    });

    it("is generated once and reused across calls", () => {
        const first = (schema as any).cloneStorage(record());
        const second = (schema as any).cloneStorage(record());

        expect(first).toEqual(second);
    });

    it("leaves a schema without renames cloneable through the same function", () => {
        const plainSchema = s.define("clone_storage_plain", {
            id: s.string().key(),
            name: s.string(),
            when: s.date(),
        }).compile();

        const source = { id: "a", name: "n", when: new Date("2021-05-06T00:00:00.000Z") };

        expect((plainSchema as any).cloneStorage(source)).toEqual(structuredClone(source));
    });
});
