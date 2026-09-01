import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { PouchDbPlugin } from '../PouchDbPlugin';
import { TestDataStore } from './datastore/PouchDbDatastore';

/**
 * Casing calls, which this plugin cannot verify through `describePluginContract` — that store
 * declares a composite key PouchDB rejects for the whole event.
 *
 * PouchDB never renders a filter: `PouchDbTranslator.evaluateFilter` runs the caller's closure, and
 * the expression tree is used only to choose an index. A call means no index matches, so these fall
 * back to a scan. The answers still have to be right, which is what this asserts.
 */

const generateDbName = () => `z-${uuidv4()}-db`;
const stores: TestDataStore[] = [];
const factory = () => {
    const store = new TestDataStore(new PouchDbPlugin(generateDbName()) as IDbPlugin);
    stores.push(store);
    return store;
};

const seeded = async () => {
    const store = factory();
    await store.products.addAsync(
        { name: "Alpha", price: 10, category: "tools", inStock: true, tags: ["computer"] } as never,
        { name: "Bravo", price: 30, category: "tools", inStock: true, tags: ["computer"] } as never,
        { name: "Charlie", price: 20, category: "toys", inStock: false, tags: ["accessory"] } as never,
    );
    await store.saveChangesAsync();
    return store;
};

describe("casing calls on a filter", () => {

    afterAll(async () => {
        await Promise.all(stores.splice(0).map(x => x.destroyAsync().catch(() => undefined)));
    });

    it("matches through a lower-case call", async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.name.toLowerCase() === "bravo").toArrayAsync();

        expect(found.map(p => p.name)).toEqual(["Bravo"]);
    });

    it("matches through an upper-case call", async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.category.toUpperCase() === "TOYS").toArrayAsync();

        expect(found.map(p => p.name)).toEqual(["Charlie"]);
    });

    it("is case-folded rather than case-blind", async () => {
        const store = await seeded();

        expect(await store.products.where(p => p.name.toLowerCase() === "Bravo").toArrayAsync()).toEqual([]);
    });

    it("matches through a call on a relational comparator", async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.name.toLowerCase() > "b").toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(["Bravo", "Charlie"]);
    });

    it("matches through modulo", async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.price % 20 === 0).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(["Charlie"]);
    });

    it("matches through multiplication by a float", async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.price * 1.5 > 40).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(["Bravo"]);
    });

    it("gives multiplication precedence over addition", async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.price + 3 * 4 === 22).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(["Alpha"]);
    });

    it("matches through a call on both sides", async () => {
        const store = await seeded();
        const found = await store.products
            .where(p => p.name.toLowerCase() === p.category.toLowerCase())
            .toArrayAsync();

        expect(found).toEqual([]);
    });
});
