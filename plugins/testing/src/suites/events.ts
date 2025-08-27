import { generateData } from '../utils/dataGenerator';
import { describe, it, expect } from 'vitest';
import { TestDataStore } from '../context';
import { IDbPlugin } from 'routier-core';

const pluginFactory: () => IDbPlugin = () => null as any; // Replace with your plugin
const factory = () => new TestDataStore(pluginFactory());

describe("Events Tests", () => {

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