import { generateData, wait } from '@routier/test-utils';
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { IDbPlugin, uuid, uuidv4 } from '@routier/core';
import { PerformanceCapability, TracingCapability } from '@routier/core/capabilities';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { SimpleBenchmark } from './utils/SimpleBenchmark';

const pluginFactory: () => IDbPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const store = new TestDataStore(pluginFactory());

    stores.push(store);

    return store;
};

describe("Comments Tests", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });


    describe('Add Operations', () => {
        it("Can add item with default", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.comments.schema, 1);

            // Act
            const [added] = await dataStore.comments.addAsync(item);
            const response = await dataStore.saveChangesAsync();

            // Assert
            expect(response.aggregate.size).toBe(1);
            expect(added._id).toStrictEqual(expect.any(String));
            expect(added.author).toStrictEqual(item.author);
            expect(added.content).toBe(item.content);
            expect(added.replies).toStrictEqual(item.replies);
            expect(added.createdAt).toBe(item.createdAt);
            expect(added.createdAt).toBeDefined();
        });
    });

    it("Can add item with default and tracing", async () => {
        const dataStore = factory();

        const tracing = new PerformanceCapability();

        tracing.apply(dataStore);

        // Arrange
        const [item] = generateData(dataStore.comments.schema, 1);

        // Act
        const [added] = await dataStore.comments.addAsync(item);
        const response = await dataStore.saveChangesAsync();

        await wait(2000);

        // Assert
        expect(response.aggregate.size).toBe(1);
        expect(added._id).toStrictEqual(expect.any(String));
        expect(added.author).toStrictEqual(item.author);
        expect(added.content).toBe(item.content);
        expect(added.replies).toStrictEqual(item.replies);
        expect(added.createdAt).toBe(item.createdAt);
        expect(added.createdAt).toBeDefined();
    });
});