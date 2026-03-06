import { describe, expect, it } from "@jest/globals";
import { TagCollection } from "./TagCollection";

describe("TagCollection contract expectations", () => {
    it("size should reflect unique key count when setting the same key multiple times", () => {
        const tags = new TagCollection();
        const k = { id: "k" };

        tags.set(k, "first");
        tags.set(k, "second");

        expect(Array.from(tags.keys())).toHaveLength(1);
        expect(tags.size).toBe(1);
    });

    it("setMany should increase size by number of unique inserted keys", () => {
        const tags = new TagCollection();
        const keys = [{ id: "a" }, { id: "b" }, { id: "c" }];

        tags.setMany(keys, "value");

        expect(Array.from(tags.keys())).toHaveLength(3);
        expect(tags.size).toBe(3);
    });

    it("setMany with duplicate keys should count unique keys only", () => {
        const tags = new TagCollection();
        const a = { id: "a" };

        tags.setMany([a, a], "value");

        expect(Array.from(tags.keys())).toHaveLength(1);
        expect(tags.size).toBe(1);
    });

    it("combine should keep size in sync with resulting map content", () => {
        const tags = new TagCollection();
        const other = new TagCollection();
        const a = { id: "a" };
        const b = { id: "b" };
        const c = { id: "c" };

        tags.set(a, "va");
        other.set(b, "vb");
        other.set(c, "vc");

        tags.combine(other);

        expect(Array.from(tags.keys())).toHaveLength(3);
        expect(tags.size).toBe(3);
    });

    it("combine with overlapping keys should not inflate size", () => {
        const tags = new TagCollection();
        const other = new TagCollection();
        const shared = { id: "shared" };
        const onlyLeft = { id: "left" };
        const onlyRight = { id: "right" };

        tags.set(shared, "left-shared");
        tags.set(onlyLeft, "left-only");

        other.set(shared, "right-shared");
        other.set(onlyRight, "right-only");

        tags.combine(other);

        expect(Array.from(tags.keys())).toHaveLength(3);
        expect(tags.get(shared)).toBe("right-shared");
        expect(tags.size).toBe(3);
    });

    it("dispose should clear both data and reported size", () => {
        const tags = new TagCollection();
        const a = { id: "a" };
        const b = { id: "b" };

        tags.set(a, "va");
        tags.set(b, "vb");
        tags[Symbol.dispose]();

        expect(Array.from(tags.keys())).toEqual([]);
        expect(tags.size).toBe(0);
    });
});
