import { describe, expect, it } from '@jest/globals';
import { SlotPath } from './SlotPath';

describe("SlotPath", () => {
    it("joins path segments with dots", () => {
        const path = new SlotPath("factory", "function", "ifs");
        expect(path.get()).toBe("factory.function.ifs");
    });

    it("supports push and retrieving parent paths via get(up)", () => {
        const path = new SlotPath("a", "b");
        path.push("c", "d");

        expect(path.get()).toBe("a.b.c.d");
        expect(path.get(1)).toBe("a.b.c");
        expect(path.get(2)).toBe("a.b");
    });

    it("returns a defensive copy from path getter", () => {
        const path = new SlotPath("x", "y");
        const copy = path.path;
        copy.push("z");

        expect(path.get()).toBe("x.y");
        expect(copy.join(".")).toBe("x.y.z");
    });
});
