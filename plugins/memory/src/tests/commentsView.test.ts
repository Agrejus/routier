import { generateData, wait } from '@routier/test-utils';
import { describe, it, afterAll } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { waitFor } from './utils/waitFor';

const pluginFactory: () => MemoryPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const plugin = pluginFactory();

    const store = new TestDataStore(plugin);

    stores.push(store);

    return { dataStore: store, plugin };
};

describe("Comments View Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Query Operations', () => {
        it("Should auto save a view when changes occur", async () => {
            const { plugin, dataStore } = factory();

            const data = generateData(dataStore.comments.schema, 10);
            plugin.seed(dataStore.comments.schema, data.map(entity => dataStore.comments.schema.enrich(entity, "proxy")));

            const [item] = generateData(dataStore.comments.schema, 1);

            // Act
            await dataStore.comments.addAsync(item);
            await dataStore.saveChangesAsync();

            // Assert
            await waitFor(async () => {
                return await dataStore.commentsView.countAsync() === 11;
            });
        });

        it("Should fire subscription changes when view updates", async () => {
            const { plugin, dataStore } = factory();

            const data = generateData(dataStore.comments.schema, 10);
            plugin.seed(dataStore.comments.schema, data.map(entity => dataStore.comments.schema.enrich(entity, "proxy")));

            const [item] = generateData(dataStore.comments.schema, 1);
            const subscriptionCallback = jest.fn();
            const commentsCallback = jest.fn();

            // Act
            dataStore.comments.subscribe().toArray(commentsCallback);
            dataStore.commentsView.subscribe().toArray(subscriptionCallback);

            await dataStore.comments.addAsync(item);
            await dataStore.saveChangesAsync();

            // Assert
            await waitFor(async () => {
                return await dataStore.commentsView.countAsync() === 11;
            });

            await wait(1000);

            expect(subscriptionCallback).toHaveBeenCalledTimes(1);
        });
    });
});