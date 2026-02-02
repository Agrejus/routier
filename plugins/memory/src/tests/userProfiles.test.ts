import { generateData } from '@routier/test-utils';
import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import type { DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

/** Untracked property names that must not be persisted to the IDbPlugin (userProfile schema). */
const UNTRACKED_PROP_NAMES = ['fullName', 'age', 'formattedAddress', 'isActive', 'getDisplayName'] as const;

function createSpyPlugin(inner: IDbPlugin): IDbPlugin & { lastBulkPersistEvent: DbPluginBulkPersistEvent | null } {
    let lastBulkPersistEvent: DbPluginBulkPersistEvent | null = null;
    return {
        get lastBulkPersistEvent() {
            return lastBulkPersistEvent;
        },
        bulkPersist(event, done) {
            lastBulkPersistEvent = event;
            inner.bulkPersist(event, done);
        },
        query(event, done) {
            return inner.query(event, done);
        },
        destroy(event, done) {
            return inner.destroy(event, done);
        },
    };
}

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

            const found = await dataStore.userProfiles.firstAsync(x => x._id === added._id)

            expect(found).toBeDefined();
            expect(typeof added.age).toBe("number");
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

    describe('Persistence (untracked properties)', () => {
        it('does not persist untracked properties to IDbPlugin; they exist after select', async () => {
            const inner = new MemoryPlugin(uuidv4());
            const spy = createSpyPlugin(inner) as ReturnType<typeof createSpyPlugin>;
            const dataStore = new TestDataStore(spy);
            stores.push(dataStore);

            const [item] = generateData(dataStore.userProfiles.schema, 1);
            const [added] = await dataStore.userProfiles.addAsync(item);
            await dataStore.saveChangesAsync();

            expect(spy.lastBulkPersistEvent).not.toBeNull();
            const schemaId = dataStore.userProfiles.schema.id;
            const schemaChanges = spy.lastBulkPersistEvent!.operation.get(schemaId);
            expect(schemaChanges).toBeDefined();
            expect(schemaChanges!.adds.length).toBeGreaterThan(0);

            for (const entity of schemaChanges!.adds as Record<string, unknown>[]) {
                for (const prop of UNTRACKED_PROP_NAMES) {
                    expect(entity).not.toHaveProperty(prop);
                }
            }

            const found = await dataStore.userProfiles.firstAsync((x) => x._id === added._id);
            expect(found).toBeDefined();
            expect(found?.fullName).toBeDefined();
            expect(found?.age).toBeDefined();
            expect(found?.formattedAddress).toBeDefined();
            expect(found?.isActive).toBeDefined();
            expect(typeof found?.getDisplayName).toBe('function');
        });
    });
});