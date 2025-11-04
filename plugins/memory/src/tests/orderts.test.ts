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

describe("Orders Tests", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });


    describe('Add Operations', () => {
        it("Can add item with default", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.orders.schema, 1);

            // Act
            const [added] = await dataStore.orders.addAsync(item);
            const response = await dataStore.saveChangesAsync();
        });
    });
});