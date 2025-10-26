import { generateData } from '@routier/test-utils';
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

describe("Performance Tests", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    it("should add items quickly", async () => {
        const dataStore = factory();
        const [item] = generateData(dataStore.comments.schema, 1);
        const ITERATIONS = 10_000;

        const startTime = performance.now();

        for (let i = 0; i < ITERATIONS; i++) {
            await dataStore.comments.addAsync(item);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTimePerOp = (totalTime / ITERATIONS) * 1000; // microseconds

        // Performance assertions
        expect(avgTimePerOp).toBeLessThan(100); // Should be under 100μs per operation
        expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds

        console.log(`Performance: ${avgTimePerOp.toFixed(2)}μs per operation`);
    });

    it("should save changes efficiently", async () => {
        const dataStore = factory();
        const items = generateData(dataStore.comments.schema, 1000);

        // Add items
        for (const item of items) {
            await dataStore.comments.addAsync(item);
        }

        const startTime = performance.now();
        await dataStore.saveChangesAsync();
        const endTime = performance.now();

        const saveTime = endTime - startTime;
        expect(saveTime).toBeLessThan(1000); // Should save in under 1 second

        console.log(`Save time: ${saveTime.toFixed(2)}ms for 1000 items`);
    });
});
