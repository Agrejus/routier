import { describe, it, expect, afterAll } from '@jest/globals';
import { generateData } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const pluginFactory: () => MemoryPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const plugin = pluginFactory();

    const store = new TestDataStore(plugin);

    stores.push(store);

    return { dataStore: store, plugin };
};

/**
 * `readonly()` collections use `"immutable"` change tracking, so what they hand back is now
 * genuinely frozen.
 *
 * This file previously ended on a bare `found.name = "NEW NAME"` with no assertion, which
 * documented the opposite: that a readonly entity could be written to and nothing would
 * happen. It passed only because `"immutable"` mode never froze anything (defect #17), so the
 * write landed on a mutable object and was silently discarded at save time. Rewritten to
 * assert the behaviour the mode exists for.
 */
describe("Immutable Items Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Query Operations', () => {
        const seeded = () => {
            const { plugin, dataStore } = factory();
            plugin.seed(dataStore.immutableItems.schema, generateData(dataStore.immutableItems.schema, 10));
            return dataStore;
        };

        it("can read a seeded item", async () => {
            const found = await seeded().immutableItems.firstAsync();

            expect(found).toBeDefined();
            expect(typeof found.name).toBe("string");
        });

        it("refuses a direct mutation instead of dropping it", async () => {
            const found = await seeded().immutableItems.firstAsync();

            // Being told is the point. An unfrozen readonly entity accepted the write and then
            // threw it away at save time, which is indistinguishable from a successful edit.
            expect(() => { found.name = "NEW NAME"; }).toThrow(TypeError);
        });

        it("keeps the original value after a refused mutation", async () => {
            const found = await seeded().immutableItems.firstAsync();
            const before = found.name;

            expect(() => { found.name = "NEW NAME"; }).toThrow();
            expect(found.name).toBe(before);
        });

        it("reports no pending changes from a refused mutation", async () => {
            const dataStore = seeded();
            const found = await dataStore.immutableItems.firstAsync();

            expect(() => { found.name = "NEW NAME"; }).toThrow();
            expect(await dataStore.hasChangesAsync()).toBe(false);
        });
    });
});
