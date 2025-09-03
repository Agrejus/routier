import { generateData } from '../utils/dataGenerator';
import { describe, it, expect } from 'vitest';
import { TestDataStore } from '../context';
import { IDbPlugin } from 'routier-core';
import { faker } from '@faker-js/faker';

const pluginFactory: () => IDbPlugin = () => null as any; // Replace with your plugin
const factory = () => new TestDataStore(pluginFactory());

describe("User Tests", () => {

    describe('Add Operations', () => {
        it("Can add item with default date and default id", async () => {
            const dataStore = factory();

            const [added] = await dataStore.users.addAsync({
                address: {
                    city: faker.location.city(),
                    state: faker.location.state(),
                    street: faker.location.streetAddress(),
                    zip: faker.location.zipCode()
                },
                age: faker.number.int(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            });

            const response = await dataStore.saveChangesAsync();

            expect(added.id).toBeDefined();
            expect(response.aggregate.size).toBe(1);
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