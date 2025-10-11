import { generateData } from '@routier/test-utils';
import { describe, it, afterAll } from '@jest/globals';
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

const waitFor = async (fn: () => Promise<boolean>) => {
    return new Promise<boolean>((resovle, reject) => {
        try {
            const wait = async () => {

                const result = await fn();

                if (result === false) {
                    setTimeout(wait, 50);
                    return;
                }

                resovle(true);
            }

            wait();
        } catch (e) {
            reject(e);
        }
    });
}

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
    });
});