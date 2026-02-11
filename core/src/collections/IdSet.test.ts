import { describe, it, expect } from "@jest/globals";
import { IdSet } from "./IdSet";

describe("IdSet", () => {
    describe("constructor", () => {
        it("stores ids and freezes the array", () => {
            const set = new IdSet(1, "a");
            expect(set.ids).toEqual([1, "a"]);
            expect(Object.isFrozen(set.ids)).toBe(true);
        });
    });

    describe("equals", () => {
        it("compares single-id sets by first element", () => {
            const a = new IdSet(1);
            const b = new IdSet(1);
            const c = new IdSet(2);
            const d = new IdSet(1, 2);

            expect(a.equals(b)).toBe(true);
            expect(a.equals(c)).toBe(false);
            // Single-id compares only the first element of the other set
            expect(a.equals(d)).toBe(true);
        });

        it("compares multi-id sets by stringified order", () => {
            const a = new IdSet(1, 2);
            const b = new IdSet(1, 2);
            const c = new IdSet(2, 1);

            expect(a.equals(b)).toBe(true);
            expect(a.equals(c)).toBe(false);
        });
    });

    describe("toString", () => {
        it("returns the single id as a string", () => {
            const set = new IdSet(42);
            expect(set.toString()).toBe("42");
        });

        it("returns comma-joined ids for multiple values", () => {
            const set = new IdSet(1, "a", 3);
            expect(set.toString()).toBe("1,a,3");
        });
    });
});
