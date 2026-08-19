import { describe, it, expect, afterAll } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

/**
 * A parameterized range filter, against prices chosen to sit ON the boundaries.
 *
 * The neighbouring suites seed random data and compare counts against an in-memory filter,
 * which cannot distinguish "the parameters were applied" from "both sides matched everything".
 * These prices make the expected answer a fixed set.
 */

const stores: TestDataStore[] = [];

const factory = () => {
    const store = new TestDataStore(new MemoryPlugin(uuidv4()));

    stores.push(store);

    return store;
};

const product = (name: string, price: number) => ({
    name,
    price,
    category: "electronics",
    inStock: true,
    tags: ["computer" as const],
});

const seed = async (dataStore: TestDataStore) => {
    await dataStore.products.addAsync(
        product("below", 49),
        product("at-min", 50),
        product("inside", 125),
        product("at-max", 200),
        product("above", 201),
    );

    await dataStore.saveChangesAsync();
};

describe("Parameterized range filtering", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    it("applies both parameters, inclusive of each bound", async () => {
        const dataStore = factory();
        await seed(dataStore);

        const minPrice = 50;
        const maxPrice = 200;
        const filteredProducts = await dataStore.products
            .where(([p, params]) => p.price >= params.minPrice && p.price <= params.maxPrice,
                { minPrice, maxPrice })
            .toArrayAsync();

        expect(filteredProducts.map(x => x.price).sort((a, b) => a - b)).toEqual([50, 125, 200]);
        expect(filteredProducts.map(x => x.name).sort()).toEqual(["at-max", "at-min", "inside"]);
    });

    it("moves with the parameter values rather than baking them in", async () => {
        const dataStore = factory();
        await seed(dataStore);

        const narrow = await dataStore.products
            .where(([p, params]) => p.price >= params.minPrice && p.price <= params.maxPrice,
                { minPrice: 100, maxPrice: 150 })
            .toArrayAsync();

        const wide = await dataStore.products
            .where(([p, params]) => p.price >= params.minPrice && p.price <= params.maxPrice,
                { minPrice: 0, maxPrice: 1000 })
            .toArrayAsync();

        expect(narrow.map(x => x.price)).toEqual([125]);
        expect(wide.length).toBe(5);
    });

    it("returns nothing when the range excludes every row", async () => {
        const dataStore = factory();
        await seed(dataStore);

        const none = await dataStore.products
            .where(([p, params]) => p.price >= params.minPrice && p.price <= params.maxPrice,
                { minPrice: 500, maxPrice: 600 })
            .toArrayAsync();

        // Pins that an empty result is a real answer, not the filter silently dropping params.
        expect(none).toEqual([]);
    });
});
