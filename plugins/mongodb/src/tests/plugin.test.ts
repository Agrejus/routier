import { beforeEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
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
