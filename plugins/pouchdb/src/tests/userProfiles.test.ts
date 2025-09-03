import { TestDataStore, generateData } from 'routier-plugin-testing';
import { describe, it, expect, afterAll } from 'vitest';
import { IDbPlugin, uuidv4 } from 'routier-core';
import { PouchDbPlugin } from '../PouchDbPlugin';

const pluginFactory: () => IDbPlugin = () => new PouchDbPlugin(uuidv4());
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
            const [item] = generateData(dataStore.userProfiles.schema, 1);

            // Act
            await dataStore.userProfiles.addAsync(item);
            await dataStore.saveChangesAsync();

            const found = await dataStore.userProfiles.firstOrUndefinedAsync(x => x.age === 0);

            expect(found).toBeDefined();
        });
    });
});