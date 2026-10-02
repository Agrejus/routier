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

describe("Optimistic writes reach PouchDB", () => {
    const opened: TestDataStore[] = [];
    const open = (plugin: IDbPlugin) => {
        const store = new TestDataStore(plugin);
        opened.push(store);
        return store;
    };

    afterAll(async () => {
        await Promise.all(opened.map(x => x.destroyAsync()));
    });

    const durablePlayers = (name: string) => open(new PouchDbPlugin(name)).players.toArrayAsync();
    const settle = () => new Promise(resolve => setTimeout(resolve, 200));

    it("stores added rows in PouchDB", async () => {
        const name = uuidv4();
        const store = open(new OptimisticUpdatesDbPlugin(new PouchDbPlugin(name)));
        await store.players.addAsync(...generateData(store.players.schema, 2));
        await store.saveChangesAsync();
        await settle();

        const durable = await durablePlayers(name);

        expect(durable.map(player => player._rev.startsWith("1-"))).toEqual([true, true]);
    });

    it("takes the revision PouchDB generated into its memory copy", async () => {
        const name = uuidv4();
        const store = open(new OptimisticUpdatesDbPlugin(new PouchDbPlugin(name)));
        await store.players.addAsync(...generateData(store.players.schema, 1));
        await store.saveChangesAsync();
        await settle();

        const [cached] = await store.players.toArrayAsync();
        const [durable] = await durablePlayers(name);

        expect(cached?._rev).toBe(durable?._rev);
    });

    it("stores every update to a row it loaded from PouchDB", async () => {
        const name = uuidv4();
        const seeder = open(new PouchDbPlugin(name));
        await seeder.players.addAsync(...generateData(seeder.players.schema, 1));
        await seeder.saveChangesAsync();

        const store = open(new OptimisticUpdatesDbPlugin(new PouchDbPlugin(name)));
        const [player] = await store.players.toArrayAsync();
        player.name = "second";
        await store.saveChangesAsync();
        await settle();
        player.name = "third";
        await store.saveChangesAsync();
        await settle();

        const [durable] = await durablePlayers(name);

        expect([durable?.name, durable?._rev.startsWith("3-")]).toEqual(["third", true]);
    });
});
