import { beforeEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { executedQueriesOf } from "@routier/core/plugins";
import { MongoDbPlugin } from "../MongoDbPlugin";
import { FakeMongoDriver } from "./FakeMongoDriver";

const products = s.define("products", {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    tags: s.array(s.string()),
    payload: s.object({ inner: s.object({ value: s.string(), count: s.number() }) }),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(products).proxy().create();
}

describe("MongoDbPlugin", () => {

    let driver: FakeMongoDriver;

    beforeEach(() => {
        driver = new FakeMongoDriver();
    });

    const open = () => new ProductStore(new MongoDbPlugin(driver));

    const seed = async () => {
        const store = open();

        await store.products.addAsync(
            { name: "alpha", category: "book", price: 10, tags: ["x"], payload: { inner: { value: "a", count: 1 } } } as any,
            { name: "beta", category: "book", price: 100, tags: ["y"], payload: { inner: { value: "b", count: 20 } } } as any,
            { name: "gamma", category: "tool", price: 50, tags: ["x", "z"], payload: { inner: { value: "c", count: 3 } } } as any,
        );
        await store.saveChangesAsync();
    };

    describe("adds", () => {

        it("assigns an _id the change tracker can match back", async () => {
            const store = open();
            const [added] = await store.products.addAsync({ name: "solo", category: "book", price: 1, tags: [], payload: { inner: { value: "v", count: 0 } } } as any);

            await store.saveChangesAsync();

            expect(added._id).toEqual(expect.any(String));

            const stored = driver.collections.get("products")!.documents;
            expect(stored).toHaveLength(1);
            expect(stored[0]._id).toBe(added._id);
        });

        it("stores nested objects and arrays natively, with no encoding", async () => {
            await seed();

            const [document] = driver.collections.get("products")!.documents;

            expect(typeof document.payload).toBe("object");
            expect(document.payload).toEqual({ inner: { value: "a", count: 1 } });
            expect(Array.isArray(document.tags)).toBe(true);
        });
    });

    describe("queries", () => {

        it("round-trips an entity", async () => {
            await seed();

            const found = await open().products.where(x => x.name === "beta").firstAsync();

            expect(found.price).toBe(100);
            expect(found.payload.inner.count).toBe(20);
        });

        it("filters on a nested property with dot notation", async () => {
            await seed();

            const found = await open().products.where(x => x.payload.inner.value === "c").toArrayAsync();

            expect(found.map(x => x.name)).toEqual(["gamma"]);
        });

        it("filters on array membership", async () => {
            await seed();

            const found = await open().products.where(x => x.tags.includes("x")).toArrayAsync();

            expect(found.map(x => x.name).sort()).toEqual(["alpha", "gamma"]);
        });

        it("combines two where calls conjunctively", async () => {
            await seed();

            const found = await open().products
                .where(x => x.category === "book")
                .where(x => x.price > 50)
                .toArrayAsync();

            expect(found.map(x => x.name)).toEqual(["beta"]);
        });

        it("sorts, skips and takes", async () => {
            await seed();

            const found = await open().products
                .sort(x => x.price)
                .skip(1)
                .take(1)
                .toArrayAsync();

            expect(found.map(x => x.name)).toEqual(["gamma"]);
        });

        /**
         * The option the plugin does NOT push down. `JsonTranslator` answers it, which is why
         * a plugin can be correct before it is fast.
         */
        it("answers an aggregate it never sent to the server", async () => {
            await seed();

            expect(await open().products.countAsync()).toBe(3);
            expect(await open().products.where(x => x.category === "book").countAsync()).toBe(2);
        });

        it("maps a projection in memory", async () => {
            await seed();

            const names = await open().products.map(x => x.name).toArrayAsync();

            expect([...names].sort()).toEqual(["alpha", "beta", "gamma"]);
        });
    });

    /**
     * The fake only proves what the plugin SENT and that the rows follow from it — a real server is
     * what proves the MQL. The sort key used to be the in-memory name, masked while core ran every
     * renamed sort in memory.
     */
    describe("renamed properties", () => {

        const labelled = s.define("labelled", {
            _id: s.string().key().identity(),
            label: s.string().from("wire_label"),
            rank: s.number().from("wire_rank"),
            embedding: s.vector(3).from("wire_embedding"),
        }).compile();

        class LabelledStore extends DataStore {
            rows = this.collection(labelled).proxy().create();
        }

        const seeded = async () => {
            const store = new LabelledStore(new MongoDbPlugin(driver));

            await store.rows.addAsync(
                { label: "bravo", rank: 3, embedding: [0, 1, 0] } as any,
                { label: "alpha", rank: 1, embedding: [1, 0, 0] } as any,
                { label: "charlie", rank: 2, embedding: [0, 0, 1] } as any,
            );
            await store.saveChangesAsync();

            return new LabelledStore(new MongoDbPlugin(driver));
        };

        it("sorts on the stored name, on the server", async () => {
            const { data, explanation } = await (await seeded()).rows.sort(x => x.rank).explain().toArrayAsync();

            expect(data.map(x => x.label)).toEqual(["alpha", "charlie", "bravo"]);
            expect(explanation.summary.memory).toBe(0);
            expect(executedQueriesOf(explanation)[0].text).toContain('"sort":{"wire_rank":1}');
        });

        it("filters, sorts and windows over stored names, on the server", async () => {
            const { data, explanation } = await (await seeded()).rows
                .where(x => x.rank >= 2)
                .sortDescending(x => x.label)
                .take(1)
                .explain()
                .toArrayAsync();

            expect(data.map(x => x.label)).toEqual(["charlie"]);
            expect(explanation.summary.memory).toBe(0);
            expect(executedQueriesOf(explanation)[0].text).toContain('"wire_rank"');
            expect(executedQueriesOf(explanation)[0].text).toContain('"sort":{"wire_label":-1}');
        });

        it("hands a projection of a renamed property back, and still projects it", async () => {
            const { data, explanation } = await (await seeded()).rows.map(x => x.label).explain().toArrayAsync();

            expect([...data].sort()).toEqual(["alpha", "bravo", "charlie"]);
            expect(explanation.summary.reasons).toEqual(["missing-capability"]);
        });

        it("filters on the server, and hands back the projection and the aggregate after it", async () => {
            const { data, explanation } = await (await seeded()).rows
                .where(x => x.rank >= 2)
                .explain()
                .sumAsync(x => x.rank);

            expect(data).toBe(5);
            expect(explanation.summary.reasons).toEqual(["missing-capability", "not-reached"]);
            expect(executedQueriesOf(explanation)[0].text).toContain('"wire_rank"');
        });

        it("takes the min, max and distinct values of a renamed property", async () => {
            const store = await seeded();

            expect(await store.rows.minAsync(x => x.rank)).toBe(1);
            expect(await store.rows.maxAsync(x => x.rank)).toBe(3);
            expect([...await store.rows.map(x => x.label).distinctAsync()].sort()).toEqual(["alpha", "bravo", "charlie"]);
        });

        it("groups on a renamed property", async () => {
            const groups = await (await seeded()).rows.toGroupAsync(x => x.label);

            expect(Object.keys(groups).sort()).toEqual(["alpha", "bravo", "charlie"]);
            expect(groups["bravo"].map(x => x.rank)).toEqual([3]);
        });

        it("hands a similarity search over a renamed vector back, and still ranks it", async () => {
            const { data, explanation } = await (await seeded()).rows
                .nearest(x => x.embedding, [1, 0.1, 0], 1)
                .explain()
                .toArrayAsync();

            expect(data.map(x => x.label)).toEqual(["alpha"]);
            expect(explanation.summary.reasons).toEqual(["missing-capability"]);
        });

        it("hands back a sort by a value computed from a property, instead of sorting by the property", async () => {
            const { data, explanation } = await (await seeded()).rows.sort(x => 10 - x.rank).explain().toArrayAsync();

            expect(data.map(x => x.label)).toEqual(["bravo", "charlie", "alpha"]);
            expect(explanation.summary.reasons).toEqual(["missing-capability"]);
            expect(executedQueriesOf(explanation)[0].text).not.toContain('"sort"');
        });
    });

    describe("updates", () => {

        it("applies a change to one property", async () => {
            await seed();

            const store = open();
            const target = await store.products.firstAsync(x => x.name === "alpha");
            target.price = 999;
            await store.saveChangesAsync();

            const reread = await open().products.firstAsync(x => x.name === "alpha");
            expect(reread.price).toBe(999);
        });

        /**
         * The defect a whole-subtree `$set` produces: writing `{ payload: { inner: { value } } }`
         * replaces `payload` and drops `count`. Mongo can address the leaf directly, so the
         * delta is flattened to a dotted path instead.
         */
        it("keeps unchanged siblings when one nested value changes", async () => {
            await seed();

            const store = open();
            const target = await store.products.firstAsync(x => x.name === "beta");
            target.payload.inner.value = "changed";
            await store.saveChangesAsync();

            const reread = await open().products.firstAsync(x => x.name === "beta");

            expect(reread.payload.inner.value).toBe("changed");
            expect(reread.payload.inner.count).toBe(20);
        });
    });

    describe("removes", () => {

        it("deletes by _id", async () => {
            await seed();

            const store = open();
            await store.products.removeAsync(await store.products.firstAsync(x => x.name === "gamma"));
            await store.saveChangesAsync();

            const remaining = await open().products.toArrayAsync();
            expect(remaining.map(x => x.name).sort()).toEqual(["alpha", "beta"]);
        });
    });

    describe("destroy", () => {

        it("drops the database and closes the driver", async () => {
            await seed();

            await open().destroyAsync();

            expect(driver.collections.size).toBe(0);
            expect(driver.closed).toBe(true);
        });
    });
});
