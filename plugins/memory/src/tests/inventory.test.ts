import { faker } from '@faker-js/faker';
import { describe, it, expect, afterAll } from 'vitest';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const generateDbName = () => `${uuidv4()}-db`;
const pluginFactory: (dbname?: string) => IDbPlugin = (dbname?: string) => new MemoryPlugin(dbname ?? generateDbName());
const stores: TestDataStore[] = [];
const factory = (dbname?: string) => {

    const store = new TestDataStore(pluginFactory(dbname));

    stores.push(store);

    return store;
};

describe("Inventory Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Add Operations', () => {
        it("Can add item", async () => {
            const dataStore = factory();

            const [added] = await dataStore.inventoryItems.addAsync({
                discontinued: false,
                name: faker.book.title(),
                quantity: faker.number.int(),
            });

            const response = await dataStore.saveChangesAsync();

            expect(added.wasRestocked).toBe(false);
            expect(added.hasCollectionName).toBe(true);
            expect(added.sku).toBeDefined();
            expect(response.aggregate.size).toBe(1);
        });

        it("Can add item and ensure injected values work", async () => {
            const dataStore = factory();

            const [added] = await dataStore.inventoryItems.addAsync({
                discontinued: false,
                name: faker.book.title(),
                quantity: faker.number.int(),
                restockDate: new Date()
            });

            const response = await dataStore.saveChangesAsync();

            expect(added.wasRestocked).toBe(true);
            expect(added.hasCollectionName).toBe(true);
            expect(added.sku).toBeDefined();
            expect(response.aggregate.size).toBe(1);
        });
    });
});