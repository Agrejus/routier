import { generateData } from '../../../../test-utils/dist';
import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const pluginFactory: () => IDbPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const store = new TestDataStore(pluginFactory());

    stores.push(store);

    return store;
};

describe("User Profiles Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Add Operations', () => {
        it("Can add item and access functions", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.userProfiles.schema, 1);

            // Act
            const [added] = await dataStore.userProfiles.addAsync(item);
            await dataStore.saveChangesAsync();

            expect(added.age).toBeTypeOf("number");
        });
    });

    describe('Select Operations', () => {

        it("Can query on computed untracked property", async () => {
            const dataStore = factory();
            // Arrange
            const items = generateData(dataStore.userProfiles.schema, 1000);

            // Act
            await dataStore.userProfiles.addAsync(...items);
            await dataStore.saveChangesAsync();

            const found = await dataStore.userProfiles
                .where(x => x.firstName.startsWith("A"))
                .where(x => x.age === 0).
                firstOrUndefinedAsync();

            // Enricher is not setting functions properly, needs to be fixed
            expect(found?.fullName).toBeDefined();
            expect(found?.age).toBeDefined();
            expect(found?.formattedAddress).toBeDefined();
            expect(found?.isActive).toBeDefined();
            expect(found?.documentType).toBeDefined();
            expect(typeof found?.getDisplayName).toBe("function");
        });
    });
});