import { describe, expect, it } from "@jest/globals";
import { etags, InferCreateType, InferType, s } from ".";

const versioned = s.define("etag_versioned", {
    id: s.string().key(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const optionalEtag = s.define("etag_optional", {
    id: s.string().key(),
    revision: s.string().etag(etags.lexical).optional(),
}).compile();

const nullableEtag = s.define("etag_nullable", {
    id: s.string().key(),
    revision: s.string().etag(etags.lexical).nullable(),
}).compile();

type Versioned = InferType<typeof versioned>;
type OptionalEtag = InferType<typeof optionalEtag>;
type NullableEtag = InferType<typeof nullableEtag>;
type Equal<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
type IsReadonly<T, K extends keyof T> = Equal<Pick<T, K>, Readonly<Pick<T, K>>>;
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;

describe("etag()", () => {
    it("marks the property as the etag and keeps its comparator", () => {
        const property = versioned.properties.find(p => p.name === "version");

        expect(property?.isEtag).toBe(true);
        expect(property?.etagComparator).toBe(etags.numeric);
    });

    it("exposes the etag property on the compiled schema", () => {
        expect(versioned.etagProperty?.name).toBe("version");
    });

    it("leaves etagProperty null when no property is an etag", () => {
        const plain = s.define("etag_none", { id: s.string().key() }).compile();

        expect(plain.etagProperty).toBeNull();
    });

    it("does not mark other properties as etags", () => {
        const name = versioned.properties.find(p => p.name === "name");

        expect(name?.isEtag).toBe(false);
        expect(name?.etagComparator).toBeNull();
    });

    it.each<[string, typeof optionalEtag | typeof nullableEtag, boolean, boolean]>([
        ["optional", optionalEtag, true, false],
        ["nullable", nullableEtag, false, true],
    ])("keeps the etag when made %s", (_, schema, isOptional, isNullable) => {
        const property = schema.etagProperty;

        expect(property?.isEtag).toBe(true);
        expect(property?.etagComparator).toBe(etags.lexical);
        expect(property?.isOptional).toBe(isOptional);
        expect(property?.isNullable).toBe(isNullable);
    });

    it("keeps optional and nullable together", () => {
        const both = s.define("etag_both", {
            id: s.string().key(),
            revision: s.string().etag(etags.lexical).optional().nullable(),
        }).compile();

        expect(both.etagProperty?.isOptional).toBe(true);
        expect(both.etagProperty?.isNullable).toBe(true);
    });

    it("rejects a second etag", () => {
        const define = () => s.define("etag_two", {
            id: s.string().key(),
            first: s.number().etag(etags.numeric),
            second: s.string().etag(etags.lexical),
        }).compile();

        expect(define).toThrow("etag() is declared on 'first', 'second'. A schema can declare one etag.  Collection Name: etag_two");
    });

    it("rejects an etag nested inside another property", () => {
        const define = () => s.define("etag_nested", {
            id: s.string().key(),
            meta: s.object({ version: s.number().etag(etags.numeric) }),
        }).compile();

        expect(define).toThrow("etag() is declared on 'meta.version', which is nested inside another property. An etag must be a root-level property.  Collection Name: etag_nested");
    });

    it("leaves the name property writable", () => {
        const writable: IsReadonly<Versioned, "name"> = false;

        expect(writable).toBe(false);
    });

    it("types the etag as readonly and leaves it out of the create type", () => {
        const readonlyVersion: IsReadonly<Versioned, "version"> = true;
        const leftOutOfCreate: "version" extends keyof InferCreateType<typeof versioned> ? false : true = true;
        const required: IsOptional<Versioned, "version"> = false;

        expect([readonlyVersion, leftOutOfCreate, required]).toEqual([true, true, false]);
    });

    it("types an optional etag as optional and keeps both variants readonly", () => {
        const optional: IsOptional<OptionalEtag, "revision"> = true;
        const nullableRequired: IsOptional<NullableEtag, "revision"> = false;
        const optionalReadonly: IsReadonly<OptionalEtag, "revision"> = true;
        const nullableReadonly: IsReadonly<NullableEtag, "revision"> = true;

        expect([optional, nullableRequired, optionalReadonly, nullableReadonly]).toEqual([true, false, true, true]);
    });
});

describe("etags", () => {
    it.each([
        [1, 2, -1],
        [2, 1, 1],
        [3, 3, 0],
        [-1, 0, -1],
        [1.5, 1.25, 1],
    ])("numeric compares %p to %p as %p", (prev, next, expected) => {
        expect(etags.numeric(prev, next)).toBe(expected);
    });

    it.each([
        ["01J000", "01J001", -1],
        ["01J001", "01J000", 1],
        ["same", "same", 0],
        ["", "a", -1],
        ["B", "a", -1],
    ])("lexical compares %p to %p as %p", (prev, next, expected) => {
        expect(etags.lexical(prev, next)).toBe(expected);
    });

    it("sorts etags oldest first", () => {
        expect([3, 1, 2].sort(etags.numeric)).toEqual([1, 2, 3]);
    });
});
