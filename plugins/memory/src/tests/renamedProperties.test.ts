import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { InferCreateType, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';

const renamedSchema = s.define("renamedItems", {
    id: s.string().key().identity(),
    city: s.string().from("c"),
    score: s.number().default(0).from("s"),
}).compile();

class RenamedDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    items = this.collection(renamedSchema).proxy().create();
}

const stores: RenamedDataStore[] = [];
const factory = () => {
    const store = new RenamedDataStore(new MemoryPlugin(uuidv4()));
    stores.push(store);
    return store;
};

const seed = async (store: RenamedDataStore, ...items: InferCreateType<typeof renamedSchema>[]) => {
    const added = await store.items.addAsync(...items);
    await store.saveChangesAsync();
    return added;
};

// Renamed properties persist under their `from` (storage) name; queries are
// written against the in-memory name and must route/deserialize accordingly
describe("Renamed Properties", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    it("should round-trip a renamed property through save and query", async () => {
        const store = factory();
        await seed(store, { city: "NYC", score: 1 });

        const all = await store.items.toArrayAsync();

        expect(all).toHaveLength(1);
        expect(all[0].city).toBe("NYC");
        expect(all[0].score).toBe(1);
    });

    it("should filter on a renamed property", async () => {
        const store = factory();
        await seed(store, { city: "NYC", score: 1 }, { city: "LA", score: 2 });

        const found = await store.items.where(x => x.city === "NYC").toArrayAsync();

        expect(found).toHaveLength(1);
        expect(found[0].city).toBe("NYC");
    });

    it("should filter on a renamed property with params", async () => {
        const store = factory();
        await seed(store, { city: "NYC", score: 1 }, { city: "LA", score: 2 });

        const found = await store.items.where(([x, p]) => x.city === p.city, { city: "LA" }).toArrayAsync();

        expect(found).toHaveLength(1);
        expect(found[0].city).toBe("LA");
    });

    it("should sort on a renamed property", async () => {
        const store = factory();
        await seed(store, { city: "NYC", score: 1 }, { city: "LA", score: 2 }, { city: "Boston", score: 3 });

        const sorted = await store.items.sort(x => x.city).toArrayAsync();

        expect(sorted.map(x => x.city)).toEqual(["Boston", "LA", "NYC"]);
    });

    it("should sort descending on a renamed property", async () => {
        const store = factory();
        await seed(store, { city: "NYC", score: 1 }, { city: "LA", score: 2 }, { city: "Boston", score: 3 });

        const sorted = await store.items.sortDescending(x => x.city).toArrayAsync();

        expect(sorted.map(x => x.city)).toEqual(["NYC", "LA", "Boston"]);
    });

    it("should update a renamed property", async () => {
        const store = factory();
        const [added] = await seed(store, { city: "NYC", score: 1 });

        added.city = "Chicago";
        await store.saveChangesAsync();

        const found = await store.items.where(x => x.city === "Chicago").toArrayAsync();

        expect(found).toHaveLength(1);
    });
});
