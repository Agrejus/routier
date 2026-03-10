import { faker } from '@faker-js/faker';
import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, InferType, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { userSchema } from './schemas/user';

const generateDbName = () => `${uuidv4()}-db`;
const pluginFactory: (dbname?: string) => IDbPlugin = (dbname?: string) => new MemoryPlugin(dbname ?? generateDbName());
const stores: TestDataStore[] = [];
const factory = (dbname?: string) => {

    const store = new TestDataStore(pluginFactory(dbname));

    stores.push(store);

    return store;
};

describe("Widget Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Add Operations', () => {
        it("Can add item and default should be null", async () => {
            const dataStore = factory();

            const [added] = await dataStore.widgets.addAsync({
                set: 1
            });

            const response = await dataStore.saveChangesAsync();

            expect(added.time).toBeNull();
            expect(response.aggregate.size).toBe(1);
        });
    });
});