import { s } from "./builder";

/**
 * `.distinct()` survives being wrapped by another modifier.
 *
 * It cannot be wrapped TODAY — `SchemaDistinct` exposes no methods, so nothing can sit above it
 * — which is the only reason the flag going uncopied never caused a bug. That is a fact about
 * one class, not a guarantee: adding `optional()` to `SchemaDistinct` the way `SchemaSearchable`
 * has it would have silently dropped the uniqueness of every property declared that way, with no
 * error and no failing test.
 *
 * These assertions are written against the paths that DO compile today, plus a direct check that
 * the copy constructor carries the flag, so the trap cannot reopen.
 */

describe("distinct survives modifiers", () => {

    const distinctOf = (schema: ReturnType<typeof s.define>, name: string) =>
        (schema.compile() as any).properties.find((p: any) => p.name === name)?.isDistinct;

    it("is set by .distinct()", () => {
        expect(distinctOf(s.define("d", { id: s.string().key(), email: s.string().distinct() }), "email")).toBe(true);
    });

    it("survives .index() before it", () => {
        expect(distinctOf(s.define("d", { id: s.string().key(), email: s.string().index("i").distinct() }), "email")).toBe(true);
    });

    it("survives .tag() before it", () => {
        expect(distinctOf(s.define("d", { id: s.string().key(), email: s.string().tag("t").distinct() }), "email")).toBe(true);
    });

    it("survives .from() before it", () => {
        expect(distinctOf(s.define("d", { id: s.string().key(), email: s.string().from("e_mail").distinct() }), "email")).toBe(true);
    });

    it("is carried by the copy constructor, so a future wrapper cannot drop it", () => {
        // The regression this file exists for. Wrapping is done here directly because no
        // modifier currently sits above SchemaDistinct — the moment one does, this stays true.
        const distinct = s.string().distinct();
        const wrapped = s.string().optional();

        Object.assign(wrapped, {});
        const copied = new (Object.getPrototypeOf(wrapped).constructor)(distinct);

        expect(copied.isDistinct).toBe(true);
    });
});
