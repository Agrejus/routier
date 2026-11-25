import { describe, expect, it } from "@jest/globals";
import { byCollection, clientWins, type Conflict, fieldMerge, isDeferred, serverWins } from "./conflicts";

type Todo = { id: string; title: string; done: boolean; due: Date | null; tags: string[] };

const base: Todo = { id: "t1", title: "Write", done: false, due: null, tags: ["a"] };

const conflict = (local: Partial<Todo>, remote: Partial<Todo> | null, changed: (keyof Todo)[]): Conflict<Todo> => {
    const localRow = { ...base, ...local };
    const before: Partial<Todo> = {};

    for (const field of changed) {
        Object.assign(before, { [field]: base[field] });
    }

    return { collectionName: "todos", kind: "update", base: before, local: localRow, remote: remote == null ? null : { ...base, ...remote } };
};

describe("serverWins", () => {
    it("accepts the server's row", () => {
        expect(serverWins<Todo>()(conflict({ title: "Mine" }, { title: "Theirs" }, ["title"]))).toBeNull();
    });
});

describe("clientWins", () => {
    it("keeps the local row", () => {
        expect(clientWins<Todo>()(conflict({ title: "Mine" }, { title: "Theirs" }, ["title"]))).toEqual({ ...base, title: "Mine" });
    });
});

describe("fieldMerge", () => {
    it("keeps a field only the client changed, and every field only the server changed", () => {
        expect(fieldMerge<Todo>()(conflict({ title: "Mine" }, { done: true }, ["title"]))).toEqual({ ...base, title: "Mine", done: true });
    });

    it("takes the server's value for a field both changed", () => {
        expect(fieldMerge<Todo>()(conflict({ title: "Mine" }, { title: "Theirs" }, ["title"]))).toEqual({ ...base, title: "Theirs" });
    });

    it("asks onBoth for a field both changed", () => {
        const merge = fieldMerge<Todo>({ onBoth: (field, values) => field === "title" ? values.local : values.remote });

        const mine = new Date("2026-02-01T00:00:00.000Z");
        const theirs = new Date("2026-03-01T00:00:00.000Z");

        expect(merge(conflict({ title: "Mine", due: mine }, { title: "Theirs", due: theirs }, ["title", "due"]))).toEqual({ ...base, title: "Mine", due: theirs });
    });

    it("passes onBoth the value before the edit", () => {
        const seen: unknown[] = [];

        fieldMerge<Todo>({ onBoth: (_, values) => { seen.push(values); return values.local; } })(conflict({ title: "Mine" }, { title: "Theirs" }, ["title"]));

        expect(seen).toEqual([{ base: "Write", local: "Mine", remote: "Theirs" }]);
    });

    it("does not ask onBoth when both sides made the same change", () => {
        let asked = 0;

        fieldMerge<Todo>({ onBoth: (_, values) => { asked++; return values.local; } })(conflict({ title: "Same" }, { title: "Same" }, ["title"]));

        expect(asked).toBe(0);
    });

    it("compares dates and arrays by value", () => {
        const due = new Date("2026-01-01T00:00:00.000Z");
        const merged = fieldMerge<Todo>()(conflict({ due: new Date(due), tags: ["b"] }, { due: new Date(due), tags: ["a"] }, ["due", "tags"]));

        expect(merged).toEqual({ ...base, due, tags: ["b"] });
    });

    it("leaves a row the server deleted deleted", () => {
        expect(fieldMerge<Todo>()(conflict({ title: "Mine" }, null, ["title"]))).toBeNull();
    });

    it("is the server's row when nothing is known about the edit", () => {
        expect(fieldMerge<Todo>()(conflict({ title: "Mine" }, { title: "Theirs" }, []))).toEqual({ ...base, title: "Theirs" });
    });
});

describe("byCollection", () => {
    const resolve = byCollection<Todo>({ todos: clientWins() });

    it("uses the collection's own resolver", () => {
        expect(resolve(conflict({ title: "Mine" }, { title: "Theirs" }, ["title"]))).toEqual({ ...base, title: "Mine" });
    });

    it("uses the fallback, the server by default, for any other collection", () => {
        const other = { ...conflict({ title: "Mine" }, { title: "Theirs" }, ["title"]), collectionName: "notes" };

        expect(resolve(other)).toBeNull();
        expect(byCollection<Todo>({}, clientWins())(other)).toEqual({ ...base, title: "Mine" });
    });
});

describe("isDeferred", () => {
    it("tells a deferral from a row or null", () => {
        expect(isDeferred({ defer: true })).toBe(true);
        expect(isDeferred<{ defer: boolean }>({ defer: false })).toBe(false);
        expect(isDeferred(null)).toBe(false);
        expect(isDeferred(base)).toBe(false);
    });
});
