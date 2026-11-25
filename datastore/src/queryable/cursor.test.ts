import { afterEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import type { InferType } from "@routier/core/schema";
import type { QueryExplanation } from "@routier/core/plugins";
import { MemoryPlugin } from "@routier/memory-plugin";
import { uuidv4 } from "@routier/core";
import { DataStore } from "../DataStore";

const postSchema = s.define("cursor_posts", {
    id: s.string().key(),
    author: s.string(),
    likes: s.number(),
    pinned: s.number().nullable(),
}).compile();

const scoreSchema = s.define("cursor_scores", {
    tenant: s.string().key(),
    player: s.string().key(),
    points: s.number(),
}).compile();

type Post = InferType<typeof postSchema>;

class Store extends DataStore {
    posts = this.collection(postSchema).proxy().create();
    scores = this.collection(scoreSchema).proxy().create();
}

const stores: Store[] = [];

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const POSTS: Post[] = [
    { id: "a", author: "x", likes: 5, pinned: null },
    { id: "b", author: "y", likes: 3, pinned: 1 },
    { id: "c", author: "x", likes: 5, pinned: 2 },
    { id: "d", author: "y", likes: 1, pinned: null },
    { id: "e", author: "x", likes: 5, pinned: 3 },
    { id: "f", author: "y", likes: 3, pinned: null },
];

const seeded = async () => {
    const store = new Store(new MemoryPlugin(`cursor-${uuidv4()}`));

    stores.push(store);
    await store.posts.addAsync(...POSTS);
    await store.scores.addAsync(
        { tenant: "t1", player: "p2", points: 1 },
        { tenant: "t1", player: "p1", points: 1 },
        { tenant: "t0", player: "p9", points: 1 },
    );
    await store.saveChangesAsync();

    return store;
};

const pages = async (page: (cursor: Post | null) => Promise<Post[]>): Promise<string[][]> => {
    const result: string[][] = [];
    let cursor: Post | null = null;

    for (; ;) {
        const rows = await page(cursor);

        if (rows.length === 0) {
            return result;
        }

        result.push(rows.map(row => row.id));
        cursor = rows[rows.length - 1];
    }
};

describe("cursor", () => {
    it("pages through rows that tie on the sort, without repeating or skipping one", async () => {
        const store = await seeded();

        const result = await pages(cursor => store.posts.sortDescending(p => p.likes).cursor(cursor).take(2).toArrayAsync());

        expect(result).toEqual([["a", "c"], ["e", "b"], ["f", "d"]]);
    });

    it("continues the order of two sorts", async () => {
        const store = await seeded();

        const result = await pages(cursor => store.posts.sort(p => p.author).sort(p => p.likes).cursor(cursor).take(4).toArrayAsync());

        expect(result).toEqual([["a", "c", "e", "d"], ["b", "f"]]);
    });

    it("continues an order over a nullable property", async () => {
        const store = await seeded();
        const result = await pages(cursor => store.posts.sort(p => p.pinned).cursor(cursor).take(4).toArrayAsync());

        expect(result).toEqual([["a", "d", "f", "b"], ["c", "e"]]);
    });

    it("orders rows that tie by every part of a composite key", async () => {
        const store = await seeded();
        const [first] = await store.scores.sort(x => x.points).cursor(null).take(1).toArrayAsync();
        const rest = await store.scores.sort(x => x.points).cursor(first).toArrayAsync();

        expect([first, ...rest].map(row => `${row.tenant}/${row.player}`)).toEqual(["t0/p9", "t1/p1", "t1/p2"]);
    });

    it("does not add a second sort by a key the query already sorts by", async () => {
        const store = await seeded();
        const { explanation } = await store.posts.sort(p => p.id).cursor(POSTS[1]).explain().toArrayAsync();

        expect(explanation.executionSteps.flatMap(step => step.options).filter(option => option.name === "sort")).toHaveLength(1);
    });

    it("orders the first page by the key where the sort ties", async () => {
        const store = await seeded();
        const rows = await store.scores.sort(x => x.points).cursor(null).toArrayAsync();

        expect(rows.map(row => `${row.tenant}/${row.player}`)).toEqual(["t0/p9", "t1/p1", "t1/p2"]);
    });

    it("adds no filter for the first page", async () => {
        const store = await seeded();
        const { explanation } = await store.posts.sort(p => p.likes).cursor(null).explain().toArrayAsync();

        expect(explanation.executionSteps.flatMap(step => step.options).map(option => option.name)).toEqual(["sort", "sort"]);
    });

    it("checks the position of a first-page cursor too", async () => {
        const store = await seeded();

        expect(() => store.posts.sort(p => p.id).take(1).cursor(null)).toThrow(".cursor() must come before .take()");
    });

    it("returns nothing after the last row", async () => {
        const store = await seeded();

        expect(await store.posts.sort(p => p.id).cursor(POSTS[5]).toArrayAsync()).toEqual([]);
    });

    it("works through the callback form", async () => {
        const store = await seeded();

        const ids = await new Promise<string[]>(resolve => store.posts.sort(p => p.id).cursor(POSTS[3]).toArray(result => {
            resolve(result.ok === "success" ? result.data.map(row => row.id) : []);
        }));

        expect(ids).toEqual(["e", "f"]);
    });

    it("needs a sort before it", async () => {
        const store = await seeded();

        expect(() => store.posts.where(p => p.likes > 0).cursor(POSTS[0])).toThrow(".cursor() needs a .sort() before it");
    });

    it.each([
        ["take", (store: Store) => store.posts.sort(p => p.id).take(2)],
        ["skip", (store: Store) => store.posts.sort(p => p.id).skip(2)],
    ])("must come before .%s()", async (name, query) => {
        const store = await seeded();

        expect(() => query(store).cursor(POSTS[0])).toThrow(`.cursor() must come before .${name}()`);
    });

    it("needs the key of the row it continues from", async () => {
        const store = await seeded();
        const withoutKey: Post = { ...POSTS[0] };

        Reflect.deleteProperty(withoutKey, "id");

        expect(() => store.posts.sort(p => p.likes).cursor(withoutKey)).toThrow("The cursor has no value for its key 'id'");
    });
});

const filterStep = async (query: Promise<{ explanation: QueryExplanation }>) => {
    const { explanation } = await query;
    const step = explanation.executionSteps.find(candidate => candidate.options.some(option => option.name === "filter"));
    const filter = step?.options.find(option => option.name === "filter");

    return { executedIn: step?.executedIn.kind, expression: filter?.detail?.expression };
};

describe("the cursor filter", () => {
    it("compares the first sort, then the next where it ties, in the database", async () => {
        const store = await seeded();

        expect(await filterStep(store.posts.sortDescending(p => p.likes).cursor(POSTS[0]).explain().toArrayAsync())).toEqual({
            executedIn: "database",
            expression: {
                type: "operator",
                operator: "||",
                left: {
                    type: "comparator", comparator: "less-than", negated: false, strict: true,
                    left: { type: "property", path: "likes" }, right: { type: "value", value: 5 },
                },
                right: {
                    type: "operator",
                    operator: "&&",
                    left: {
                        type: "comparator", comparator: "equals", negated: false, strict: true,
                        left: { type: "property", path: "likes" }, right: { type: "value", value: 5 },
                    },
                    right: {
                        type: "comparator", comparator: "greater-than", negated: false, strict: true,
                        left: { type: "property", path: "id" }, right: { type: "value", value: "a" },
                    },
                },
            },
        });
    });

    it("runs in memory for a nullable sort", async () => {
        const store = await seeded();
        const step = await filterStep(store.posts.sort(p => p.pinned).cursor(POSTS[1]).explain().toArrayAsync());

        expect(step).toEqual({ executedIn: "memory", expression: expect.objectContaining({ type: "not-parsable" }) });
    });

    it("runs in memory for a computed sort", async () => {
        const store = await seeded();
        const step = await filterStep(store.posts.sort(p => p.author.toUpperCase()).cursor(POSTS[1]).explain().toArrayAsync());

        expect(step).toEqual({ executedIn: "memory", expression: expect.objectContaining({ type: "not-parsable" }) });
    });
});
