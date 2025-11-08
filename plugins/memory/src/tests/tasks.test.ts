import { faker } from '@faker-js/faker';
import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { generateData, wait } from '@routier/test-utils';
import { waitFor } from './utils/waitFor';

const generateDbName = () => `${uuidv4()}-db`;
const pluginFactory: (dbname?: string) => IDbPlugin = (dbname?: string) => new MemoryPlugin(dbname ?? generateDbName());
const stores: TestDataStore[] = [];
const factory = (dbname?: string) => {

    const dataStore = new TestDataStore(pluginFactory(dbname));

    stores.push(dataStore);

    return dataStore;
};

describe("Task Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Add Operations', () => {
        it("Can add item with default date and default id", async () => {
            const dataStore = factory();

            const items = generateData(dataStore.tasks.schema, 5);
            const subscriptionCallback = jest.fn();
            const commentsCallback = jest.fn();

            // Act
            dataStore.tasks.subscribe().toArray(commentsCallback);
            dataStore.highPriorityTasksView.subscribe().toArray(subscriptionCallback);

            await dataStore.tasks.addAsync(...items);
            await dataStore.saveChangesAsync();

            // Assert
            await wait(1000);

            expect(commentsCallback).toHaveBeenCalledTimes(2);
            expect(subscriptionCallback).toHaveBeenCalledTimes(2);
        });
    });
});