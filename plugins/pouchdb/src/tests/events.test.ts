import { describe, it, expect, afterAll } from 'vitest';
import { generateData } from '@routier/testing-plugin';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { PouchDbPlugin } from '../PouchDbPlugin';
import { TestDataStore } from './datastore/PouchDbDatastore';

const pluginFactory: () => IDbPlugin = () => new PouchDbPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const store = new TestDataStore(pluginFactory());

    stores.push(store);

    return store;
};

describe("Events Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });


    describe('Add Operations', () => {
        it("Can add item with default date", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.events.schema, 1);

            // Act
            const [added] = await dataStore.events.addAsync(item);
            const response = await dataStore.saveChangesAsync();

            // Assert
            expect(response.aggregate.size).toBe(1);
            expect(added.endTime?.toISOString()).toBe(item.endTime?.toISOString());
        });

        it("Can add item with default static value", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.events.schema, 1);

            // Act
            const [added] = await dataStore.events.addAsync(item);
            const response = await dataStore.saveChangesAsync();
            // Assert
            expect(response.aggregate.size).toBe(1);
            expect(added.name).toBe(item.name);
            expect(added.name).toBe("James");
        });
    });

    describe('Subscription Management', () => {
        it("Should return unsubscribe function", async () => {
            const dataStore = factory();
            await dataStore.events.firstOrUndefinedAsync(w => w._id != "")
            const unsubscribe = dataStore.products.subscribe().where(w => w._id != null).firstOrUndefined(() => { });
            expect(typeof unsubscribe).toBe('function');
            unsubscribe();
        });
    });

});