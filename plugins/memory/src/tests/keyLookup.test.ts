import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const pluginFactory: () => IDbPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {
    const store = new TestDataStore(pluginFactory());
    stores.push(store);
    return store;
};

// Exercises the key-equality fast path in EphemeralDataPlugin.query: a parsed
// filter that pins the key property to one value resolves the record directly
// instead of scanning the collection
describe("Key Lookup", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    const seed = async (dataStore: TestDataStore, count: number) => {
        const items = Array.from({ length: count }, (_, i) => ({
            author: `author-${i}`,
            content: `content-${i}`
        }));

        const added = await dataStore.comments.addAsync(...items);
        await dataStore.saveChangesAsync();
        return added;
    };

    it("should find an entity by key equality", async () => {
        const dataStore = factory();
        const added = await seed(dataStore, 50);
        const target = added[25];

        const found = await dataStore.comments.where(([x, p]) => x._id === p.id, { id: target._id }).firstOrUndefinedAsync();

        expect(found).toBeDefined();
        expect(found?._id).toBe(target._id);
        expect(found?.author).toBe(target.author);
    });

    it("should return undefined when no entity has the key", async () => {
        const dataStore = factory();
        await seed(dataStore, 10);

        const found = await dataStore.comments.where(([x, p]) => x._id === p.id, { id: uuidv4() }).firstOrUndefinedAsync();

        expect(found).toBeUndefined();
    });

    it("should honor additional conditions combined with key equality", async () => {
        const dataStore = factory();
        const added = await seed(dataStore, 10);
        const target = added[3];

        const match = await dataStore.comments.where(([x, p]) => x._id === p.id && x.author === p.author, { id: target._id, author: target.author }).firstOrUndefinedAsync();
        const noMatch = await dataStore.comments.where(([x, p]) => x._id === p.id && x.author === p.author, { id: target._id, author: "someone else" }).firstOrUndefinedAsync();

        expect(match?._id).toBe(target._id);
        expect(noMatch).toBeUndefined();
    });

    it("should not treat a negated key comparison as a lookup", async () => {
        const dataStore = factory();
        const added = await seed(dataStore, 5);
        const excluded = added[0];

        const found = await dataStore.comments.where(([x, p]) => x._id !== p.id, { id: excluded._id }).toArrayAsync();

        expect(found).toHaveLength(4);
        expect(found.every(x => x._id !== excluded._id)).toBe(true);
    });

    it("should find an entity by key equality after updates", async () => {
        const dataStore = factory();
        const added = await seed(dataStore, 5);
        const target = added[2];

        target.content = "updated content";
        await dataStore.saveChangesAsync();

        const found = await dataStore.comments.where(([x, p]) => x._id === p.id, { id: target._id }).firstOrUndefinedAsync();

        expect(found?.content).toBe("updated content");
    });
});
