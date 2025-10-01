import { describe, it, expect, afterAll } from '@jest/globals';
import { generateData } from '../../../../test-utils/dist';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const pluginFactory: () => MemoryPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const plugin = pluginFactory();

    const store = new TestDataStore(plugin);

    stores.push(store);

    return { dataStore: store, plugin };
};

describe("Immutable Items Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Query Operations', () => {
        it("Can add item with default date", async () => {
            const { plugin, dataStore } = factory();

            const data = generateData(dataStore.immutableItems.schema, 10);
            plugin.seed(dataStore.immutableItems.schema, data);

            // Act
            const found = await dataStore.immutableItems.firstAsync();

            found.name = "NEW NAME";
        });
    });
});