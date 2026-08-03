import { describe, it, expect, afterAll } from '@jest/globals';
import { generateData } from '@routier/test-utils';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { OptimisticUpdatesDbPlugin } from '@routier/replication-plugin';
import { PouchDbPlugin } from '../PouchDbPlugin';
import { TestDataStore } from './datastore/PouchDbDatastore';

// The plugin owns its read-side MemoryPlugin now — callers supply only the source.
const pluginFactory: () => IDbPlugin = () => new OptimisticUpdatesDbPlugin(new PouchDbPlugin(uuidv4()));
const stores: TestDataStore[] = [];
const factory = () => {

    const store = new TestDataStore(pluginFactory());

    stores.push(store);

    return store;
};

describe("Optimistic Update Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });


    describe('Update Tests', () => {
        // The read plugin is authoritative for collections this instance has written:
        // an emptied collection must not re-hydrate from the source (whose mirrored
        // removals may still be in flight), which used to resurrect removed entities.
        it("Can add and remove data properly", async () => {
            const dataStore = factory();
            // Arrange
            const players = generateData(dataStore.players.schema, 4);

            // Act
            await dataStore.players.addAsync(...players);
            const firstSave = await dataStore.saveChangesAsync();

            expect(firstSave.aggregate.size).toBe(4);
            const firstCount = await dataStore.players.countAsync();

            expect(firstCount).toBe(4);

            await dataStore.players.removeAllAsync();
            const secondSave = await dataStore.saveChangesAsync();
            const secondCount = await dataStore.players.countAsync();

            expect(secondSave.aggregate.size).toBe(4);
            expect(secondCount).toBe(0);
        });
    });
});