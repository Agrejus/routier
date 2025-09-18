import { describe, it, expect, afterAll } from 'vitest';
import { generateData } from '../../../../test-utils/dist';
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

describe("Player Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });


    describe('One -> Many Operations', () => {
        it("Can add item with default date", async () => {
            const dataStore = factory();
            // Arrange
            const players = generateData(dataStore.players.schema, 4);

            // Act
            const savedPlayers = await dataStore.players.addAsync(...players);
            const firstSave = await dataStore.saveChangesAsync();

            expect(firstSave.aggregate.size).toBe(4);

            for (let i = 0; i < 10; i++) {
                const matchId = `match.${i + 1}`;

                for (const savedPlayer of savedPlayers) {
                    await dataStore.playerMatches.addAsync({
                        matchId,
                        playerId: savedPlayer._id,
                        seasonId: "one"
                    });
                }
            }

            const secondSave = await dataStore.saveChangesAsync();
            expect(secondSave.aggregate.size).toBe(40);

            const distinctPlayers = await dataStore.players.map(x => x._id).toArrayAsync();

            const matches = await dataStore.playerMatches.where(([x, p]) => p.distinctPlayers.includes(x.playerId), { distinctPlayers }).toArrayAsync();

            expect(matches.length).toBe(40);
        });
    });
});