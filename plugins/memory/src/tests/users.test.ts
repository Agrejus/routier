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

describe("User Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

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
            expect(added.createdDate).toEqual(new Date("01/01/1900 8:00 AM"));
            expect(response.aggregate.size).toBe(1);
        });
    });
});