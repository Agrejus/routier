import { afterEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import type { DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { PluginEventResult, type PluginEventCallbackResult } from "@routier/core/results";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "../DataStore";
import type { InspectedCollection, InspectedCount, InspectedPage, InspectedRow } from "./types";

const productSchema = s.define("inspectProducts", {
    id: s.string().key().identity(),
    name: s.string(),
    tags: s.array(s.string()),
}).compile();

const orderSchema = s.define("inspectOrders", {
    id: s.string().key().identity(),
    total: s.number(),
}).compile();

const productNameSchema = s.define("inspectProductNames", {
    id: s.string().key(),
    name: s.string(),
}).compile();

class InspectedStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
    orders = this.collection(orderSchema).immutable().create();
    productNames = this.view(productNameSchema)
        .derive(done => {
            done([{ id: "n1", name: "first" }, { id: "n2", name: "second" }]);
            return () => undefined;
        })
        .create();
}

class EmptyStore extends DataStore {}

class FailingQueriesPlugin extends MemoryPlugin {
    private readonly failure: Error | string;

    constructor(databaseName: string, failure: Error | string = "query refused") {
        super(databaseName);
        this.failure = failure;
    }

    override query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        done(PluginEventResult.error(event.id, this.failure));
    }
}

const stores: DataStore[] = [];
let storeId = 0;

afterEach(() => {
    for (const store of stores.splice(0)) store[Symbol.dispose]();
});

function track<T extends DataStore>(store: T): T {
    stores.push(store);
    return store;
}

function createStore() {
    storeId++;
    return track(new InspectedStore(new MemoryPlugin(`inspect-${storeId}`)));
}

function collectionNamed(store: DataStore, name: string): InspectedCollection {
    const collection = store.inspect().collections.find(candidate => candidate.name === name);
    if (collection === undefined) throw new Error(`no inspected collection named ${name}`);
    return collection;
}

async function seedProducts(store: InspectedStore, count: number) {
    const names = Array.from({ length: count }, (_, index) => `product-${index}`);
    await store.products.addAsync(...names.map(name => ({ name, tags: [name] })));
    await store.saveChangesAsync();
}

async function eventually(assertion: () => void | Promise<void>, timeoutMs = 2000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            await assertion();
            return;
        } catch (error) {
            if (Date.now() > deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

function namesOf(page: InspectedPage | undefined): ReadonlyArray<InspectedRow["name"]> {
    if (page?.status !== "success") throw new Error(`expected rows, got ${page?.status}`);
    return page.rows.map(row => row.name);
}

describe("DataStore.inspect() collections", () => {
    it("lists every collection and view with its name, schema id, and kind", () => {
        const store = createStore();

        expect(store.inspect().collections.map(({ name, schemaId, kind }) => ({ name, schemaId, kind }))).toEqual([
            { name: "inspectProducts", schemaId: productSchema.id, kind: "collection" },
            { name: "inspectOrders", schemaId: orderSchema.id, kind: "collection" },
            { name: "inspectProductNames", schemaId: productNameSchema.id, kind: "view" },
        ]);
    });

    it("exposes only names, kinds, and read operations on each collection", () => {
        const [products] = createStore().inspect().collections;

        expect(Object.keys(products).sort()).toEqual(["count", "keyOf", "kind", "name", "schemaId", "watchCount", "watchPage"]);
    });

    it("names the plugin and database the store runs on", () => {
        const inspection = createStore().inspect();

        expect(inspection.plugin).toEqual({ name: "MemoryPlugin", databaseName: `inspect-${storeId}` });
        expect(Object.isFrozen(inspection.plugin)).toBe(true);
    });

    it("lists nothing for a store with no collections", () => {
        const store = track(new EmptyStore(new MemoryPlugin("inspect-empty")));

        expect(store.inspect().collections).toEqual([]);
    });
});

describe("InspectedCollection.count()", () => {
    it("counts the rows in a collection", async () => {
        const store = createStore();
        await seedProducts(store, 3);

        await expect(collectionNamed(store, "inspectProducts").count()).resolves.toBe(3);
    });

    it("counts zero for an empty collection", async () => {
        await expect(collectionNamed(createStore(), "inspectOrders").count()).resolves.toBe(0);
    });

    it("counts a view's rows", async () => {
        const productNames = collectionNamed(createStore(), "inspectProductNames");

        await eventually(() => expect(productNames.count()).resolves.toBe(2));
    });

    it("rejects when the backend fails", async () => {
        const store = track(new InspectedStore(new FailingQueriesPlugin("inspect-failing-count")));

        await expect(collectionNamed(store, "inspectOrders").count()).rejects.toBeDefined();
    });
});

describe("InspectedCollection.keyOf()", () => {
    it("identifies a row by its key, the same across deliveries", async () => {
        const store = createStore();
        await seedProducts(store, 2);
        const products = collectionNamed(store, "inspectProducts");
        const pages: InspectedPage[] = [];
        const stop = products.watchPage({ skip: 0, take: 50 }, page => pages.push(page));
        await eventually(() => expect(pages).toHaveLength(1));
        await store.products.addAsync({ name: "third", tags: [] });
        await store.saveChangesAsync();
        await eventually(() => expect(pages).toHaveLength(2));
        stop();

        const keys = pages.map(page => page.status === "success" ? page.rows.map(row => products.keyOf(row)) : []);

        expect(new Set(keys[0]).size).toBe(2);
        expect(keys[1].slice(0, 2)).toEqual(keys[0]);
        expect(keys[1][2]).not.toBe(keys[0][0]);
    });
});

describe("InspectedCollection.watchCount()", () => {
    it("delivers the current count, then the count after a save", async () => {
        const store = createStore();
        await seedProducts(store, 2);
        const counts: InspectedCount[] = [];
        const stop = collectionNamed(store, "inspectProducts").watchCount(result => counts.push(result));

        await eventually(() => expect(counts).toEqual([{ status: "success", count: 2 }]));
        await seedProducts(store, 1);

        await eventually(() => expect(counts.at(-1)).toEqual({ status: "success", count: 3 }));
        stop();
    });

    it("stops delivering once stopped", async () => {
        const store = createStore();
        const counts: InspectedCount[] = [];
        const stop = collectionNamed(store, "inspectProducts").watchCount(result => counts.push(result));
        await eventually(() => expect(counts).toHaveLength(1));

        stop();
        await seedProducts(store, 1);
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(counts).toEqual([{ status: "success", count: 0 }]);
    });

    it("delivers an error when the backend fails", async () => {
        const store = track(new InspectedStore(new FailingQueriesPlugin("inspect-failing-watch-count")));
        const counts: InspectedCount[] = [];

        const stop = collectionNamed(store, "inspectOrders").watchCount(result => counts.push(result));

        await eventually(() => expect(counts).toEqual([{ status: "error", error: new Error("query refused") }]));
        stop();
    });
});

describe("InspectedCollection.watchPage()", () => {
    it("delivers only the requested page", async () => {
        const store = createStore();
        await seedProducts(store, 5);
        const pages: InspectedPage[] = [];

        const stop = collectionNamed(store, "inspectProducts").watchPage({ skip: 1, take: 2 }, page => pages.push(page));

        await eventually(() => expect(namesOf(pages[0])).toEqual(["product-1", "product-2"]));
        stop();
    });

    it("delivers an empty page past the end", async () => {
        const store = createStore();
        await seedProducts(store, 2);
        const pages: InspectedPage[] = [];

        const stop = collectionNamed(store, "inspectProducts").watchPage({ skip: 50, take: 50 }, page => pages.push(page));

        await eventually(() => expect(namesOf(pages[0])).toEqual([]));
        stop();
    });

    it("delivers a view's rows", async () => {
        const pages: InspectedPage[] = [];

        const stop = collectionNamed(createStore(), "inspectProductNames").watchPage({ skip: 0, take: 50 }, page => pages.push(page));

        await eventually(() => expect(namesOf(pages.at(-1))).toEqual(["first", "second"]));
        stop();
    });

    it("delivers the page again after a save", async () => {
        const store = createStore();
        await seedProducts(store, 1);
        const pages: InspectedPage[] = [];
        const stop = collectionNamed(store, "inspectProducts").watchPage({ skip: 0, take: 50 }, page => pages.push(page));
        await eventually(() => expect(pages).toHaveLength(1));

        await store.products.addAsync({ name: "added", tags: [] });
        await store.saveChangesAsync();

        await eventually(() => expect(namesOf(pages.at(-1))).toEqual(["product-0", "added"]));
        stop();
    });

    it("stops delivering once stopped", async () => {
        const store = createStore();
        const pages: InspectedPage[] = [];
        const stop = collectionNamed(store, "inspectProducts").watchPage({ skip: 0, take: 50 }, page => pages.push(page));
        await eventually(() => expect(pages).toHaveLength(1));

        stop();
        await seedProducts(store, 1);
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(pages).toHaveLength(1);
    });

    it("delivers an error when the backend fails", async () => {
        const store = track(new InspectedStore(new FailingQueriesPlugin("inspect-failing-page")));
        const pages: InspectedPage[] = [];

        const stop = collectionNamed(store, "inspectOrders").watchPage({ skip: 0, take: 50 }, page => pages.push(page));

        await eventually(() => expect(pages).toEqual([{ status: "error", error: new Error("query refused") }]));
        stop();
    });

    it("passes a backend Error through unchanged", async () => {
        const failure = new Error("backend down");
        const store = track(new InspectedStore(new FailingQueriesPlugin("inspect-failing-error", failure)));
        const pages: InspectedPage[] = [];

        const stop = collectionNamed(store, "inspectOrders").watchPage({ skip: 0, take: 50 }, page => pages.push(page));

        await eventually(() => expect(pages).toHaveLength(1));
        expect(pages[0].status === "error" && pages[0].error).toBe(failure);
        stop();
    });
});

describe("StoreInspection.disposed", () => {
    it("is not aborted while the store is alive", () => {
        expect(createStore().inspect().disposed.aborted).toBe(false);
    });

    it("aborts when the store is disposed", () => {
        const store = createStore();
        const { disposed } = store.inspect();
        const heard: string[] = [];
        disposed.addEventListener("abort", () => heard.push("abort"));

        store[Symbol.dispose]();

        expect(disposed.aborted).toBe(true);
        expect(heard).toEqual(["abort"]);
    });

    it("aborts when the store is destroyed", async () => {
        const store = createStore();
        const { disposed } = store.inspect();

        await store.destroyAsync();

        expect(disposed.aborted).toBe(true);
    });

    it("is already aborted when a disposed store is inspected", () => {
        const store = createStore();
        store[Symbol.dispose]();

        expect(store.inspect().disposed.aborted).toBe(true);
    });
});

describe("DataStore.inspect() is read-only", () => {
    async function firstProductPage(store: InspectedStore): Promise<ReadonlyArray<InspectedRow>> {
        const pages: InspectedPage[] = [];
        const stop = collectionNamed(store, "inspectProducts").watchPage({ skip: 0, take: 50 }, page => pages.push(page));
        await eventually(() => expect(pages).toHaveLength(1));
        stop();
        const [page] = pages;
        if (page.status !== "success") throw page.error;
        return page.rows;
    }

    it("freezes the inspection, its collection list, and each collection", () => {
        const inspection = createStore().inspect();

        expect(Object.isFrozen(inspection)).toBe(true);
        expect(Object.isFrozen(inspection.collections)).toBe(true);
        expect(inspection.collections.every(collection => Object.isFrozen(collection))).toBe(true);
    });

    it("rejects an attempt to replace a collection's name", () => {
        const [products] = createStore().inspect().collections;

        expect(() => Object.assign(products, { name: "renamed" })).toThrow(TypeError);
    });

    it("rejects an attempt to add to the collection list", () => {
        const { collections } = createStore().inspect();

        expect(() => Array.prototype.push.call(collections, collections[0])).toThrow(TypeError);
    });

    it("hands out frozen rows in a frozen page", async () => {
        const store = createStore();
        await seedProducts(store, 1);

        const rows = await firstProductPage(store);

        expect(Object.isFrozen(rows)).toBe(true);
        expect(() => Object.assign(rows[0], { name: "changed" })).toThrow(TypeError);
        expect(() => Array.prototype.push.call(rows[0].tags, "changed")).toThrow(TypeError);
    });

    it("hands out copies, so the app's tracked entities are not the rows", async () => {
        const store = createStore();
        await seedProducts(store, 1);
        const [tracked] = await store.products.toArrayAsync();

        const rows = await firstProductPage(store);
        tracked.name = "renamed by the app";

        expect(rows[0].name).toBe("product-0");
        await expect(store.hasChangesAsync()).resolves.toBe(true);
    });

    it("leaves the store without pending changes after reading rows", async () => {
        const store = createStore();
        await seedProducts(store, 2);

        await firstProductPage(store);

        await expect(store.hasChangesAsync()).resolves.toBe(false);
        expect((await store.products.toArrayAsync()).map(product => product.name)).toEqual(["product-0", "product-1"]);
    });
});
