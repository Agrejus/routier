import { describe, expect, it } from "@jest/globals";
import { javascriptName, memoryJoinQuery, memoryReadQuery } from "./memoryExplain";

describe("javascriptName", () => {
    it("is the name itself when it is an identifier", () => {
        expect(["posts", "_rows", "$cache", "a1"].map(javascriptName)).toEqual(["posts", "_rows", "$cache", "a1"]);
    });

    it("is a string lookup when it is not", () => {
        expect(["full-text", "1st", "a b", "x-1"].map(javascriptName)).toEqual([
            'collections["full-text"]',
            'collections["1st"]',
            'collections["a b"]',
            'collections["x-1"]',
        ]);
    });
});

describe("memoryReadQuery", () => {
    it("filters the collection, with the values as parameters", () => {
        expect(memoryReadQuery("posts", { text: "x.likes > ?", parameters: [5] }, 2)).toEqual({
            text: "posts.filter(x => x.likes > ?)",
            parameters: [5],
            language: "javascript",
            note: "returned 2 in-memory records",
        });
    });

    it("is the collection alone, with no parameters, when there is no filter", () => {
        expect(memoryReadQuery("posts", { text: "", parameters: [] }, 1)).toStrictEqual({
            text: "posts",
            language: "javascript",
            note: "returned 1 in-memory record",
        });
    });
});

describe("memoryJoinQuery", () => {
    it("narrows to the outer keys", () => {
        expect(memoryJoinQuery("members", "teamId", 3, 2)).toEqual({
            text: "members.filter(x => outerKeys.has(x.teamId))",
            language: "javascript",
            note: "the join's inner side: returned 3 in-memory records, narrowed by 2 outer keys",
        });
    });

    it("says one key and one record in the singular", () => {
        expect(memoryJoinQuery("members", "teamId", 1, 1).note).toBe("the join's inner side: returned 1 in-memory record, narrowed by 1 outer key");
    });

    it("is a full scan when there are no outer keys to narrow by", () => {
        expect(memoryJoinQuery("members", "teamId", 4, null)).toEqual({
            text: "members",
            language: "javascript",
            note: "the join's inner side: returned 4 in-memory records, a full scan",
        });
    });
});
