import { generateData } from '@routier/test-utils';
import { describe, it, expect, afterAll } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { collectingSink, RetryDbPlugin, TelemetryDbPlugin, TelemetryEvent } from '@routier/core/plugins';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const stores: TestDataStore[] = [];

const factory = (events: TelemetryEvent[]) => {

    const store = new TestDataStore(new TelemetryDbPlugin(new MemoryPlugin(uuidv4()), { onEvent: collectingSink(events) }));

    stores.push(store);

    return store;
};

describe("Telemetry Tests", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    it("Records a save and a query without changing their results", async () => {
        const events: TelemetryEvent[] = [];
        const dataStore = factory(events);

        const [item] = generateData(dataStore.comments.schema, 1);

        const [added] = await dataStore.comments.addAsync(item);
        const response = await dataStore.saveChangesAsync();

        const persists = events.filter(x => x.operation === "bulkPersist" && x.ok === "success");

        expect(persists.length).toBeGreaterThanOrEqual(1);
        expect(persists.some(x => x.schemas.includes(dataStore.comments.schema.collectionName))).toBe(true);

        const found = await dataStore.comments.toArrayAsync();

        expect(events.filter(x => x.operation === "query" && x.ok === "success").length).toBeGreaterThanOrEqual(1);

        for (const event of events) {
            expect(event.durationMs).toBeGreaterThanOrEqual(0);
            expect(event.eventId.length).toBeGreaterThan(0);
        }

        // Wrapping must be invisible to the caller: the data itself is what an unwrapped store returns.
        expect(response.aggregate.size).toBe(1);
        expect(added._id).toStrictEqual(expect.any(String));
        expect(added.author).toStrictEqual(item.author);
        expect(added.content).toBe(item.content);
        expect(added.replies).toStrictEqual(item.replies);
        expect(added.createdAt).toBe(item.createdAt);
        expect(found.length).toBe(1);
        expect(found[0]._id).toBe(added._id);
    });

    it("Stacks with the other decorators", async () => {
        const events: TelemetryEvent[] = [];
        const store = new TestDataStore(new TelemetryDbPlugin(
            new RetryDbPlugin(new MemoryPlugin(uuidv4())),
            { onEvent: collectingSink(events) }
        ));

        stores.push(store);

        const [item] = generateData(store.comments.schema, 1);

        const [added] = await store.comments.addAsync(item);
        const response = await store.saveChangesAsync();
        const found = await store.comments.toArrayAsync();

        expect(response.aggregate.size).toBe(1);
        expect(found.length).toBe(1);
        expect(found[0]._id).toBe(added._id);
        expect(events.some(x => x.operation === "bulkPersist")).toBe(true);
        expect(events.some(x => x.operation === "query")).toBe(true);
    });
});
