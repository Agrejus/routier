import { describe, it, expect } from '@jest/globals';
import { s } from './index';

/**
 * `clone` must preserve an explicit `null` — known-defects #66.
 *
 * The guard used to be `!= null`, which treats "the caller wrote null" and "the property is not
 * there" as the same thing. They are not: the first is a value the schema declares as legal, and
 * dropping it silently changed what every ephemeral backend handed back on a read.
 */
const schema = s.define("clone_nulls", {
    id: s.string().key(),
    note: s.string().nullable(),
    count: s.number().nullable(),
    when: s.date().nullable(),
    tags: s.array(s.string()).nullable(),
    maybe: s.string().optional(),
}).compile();

describe("clone and null", () => {

    it("copies an explicit null rather than dropping the property", () => {
        const cloned = schema.clone({ id: "a", note: null, count: null, when: null, tags: null } as any) as any;

        expect(cloned.note).toBeNull();
        expect(cloned.count).toBeNull();
        expect(cloned.when).toBeNull();
        expect(cloned.tags).toBeNull();
    });

    it("still omits a property that is absent", () => {
        const cloned = schema.clone({ id: "a" } as any) as any;

        expect(Object.hasOwn(cloned, "note")).toBe(false);
        expect(Object.hasOwn(cloned, "maybe")).toBe(false);
    });

    it("still deep-copies the values it does carry", () => {
        const when = new Date("2020-01-02T03:04:05.000Z");
        const tags = ["a", "b"];
        const cloned = schema.clone({ id: "a", note: "n", count: 1, when, tags } as any) as any;

        expect(cloned.when).toEqual(when);
        expect(cloned.when).not.toBe(when);
        expect(cloned.tags).toEqual(tags);
        expect(cloned.tags).not.toBe(tags);
    });
});
