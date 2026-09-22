import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

type DataStoreModule = typeof import("../DataStore");

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
});

const itemSchema = s.define("productionItems", {
    id: s.string().key().identity(),
}).compile();

async function loadInProduction(): Promise<DataStoreModule> {
    process.env.NODE_ENV = "production";
    let loaded: DataStoreModule | null = null;
    await jest.isolateModulesAsync(async () => {
        loaded = await import("../DataStore");
    });
    if (loaded === null) throw new Error("DataStore did not load");
    return loaded;
}

describe("DataStore.inspect() in production", () => {
    it("still lists and counts collections", async () => {
        const { DataStore } = await loadInProduction();
        class ItemStore extends DataStore {
            items = this.collection(itemSchema).proxy().create();
        }
        const store = new ItemStore(new MemoryPlugin("inspect-production"));

        const [items] = store.inspect().collections;

        expect(items.name).toBe("productionItems");
        await expect(items.count()).resolves.toBe(0);
        store[Symbol.dispose]();
    });
});
