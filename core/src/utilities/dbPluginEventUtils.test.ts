import { describe, expect, it } from '@jest/globals';
import { BulkPersistChanges, SchemaCollection } from '../collections';
import { DbPluginBulkPersistEvent } from '../plugins';
import { s } from '../schema';
import { toEventArray } from './dbPluginEventUtils';

const first = s.define("events_first", { id: s.string().key() }).compile().id;
const second = s.define("events_second", { id: s.string().key() }).compile().id;

const eventOf = (operation: BulkPersistChanges): DbPluginBulkPersistEvent => ({
    id: "event",
    operation,
    schemas: new SchemaCollection(),
    source: "test",
    action: "persist"
});

const update = (id: string) => ({ entity: { id }, changeType: "propertiesChanged" as const, delta: { id } });

describe("toEventArray", () => {
    it("returns no events for an operation with no schemas", () => {
        expect(toEventArray(eventOf(new BulkPersistChanges()))).toEqual([]);
    });

    it("skips a schema whose changes hold no items", () => {
        const operation = new BulkPersistChanges();
        operation.resolve(first);

        expect(toEventArray(eventOf(operation))).toEqual([]);
    });

    it("lists adds, then updates, then removes, one event per item", () => {
        const operation = new BulkPersistChanges();
        const changes = operation.resolve(first);
        changes.adds.push({ id: "a1" } as never, { id: "a2" } as never);
        changes.updates.push(update("u1") as never, update("u2") as never);
        changes.removes.push({ id: "r1" } as never, { id: "r2" } as never);

        expect(toEventArray(eventOf(operation))).toEqual([
            [first, { type: "add", data: { id: "a1" } }],
            [first, { type: "add", data: { id: "a2" } }],
            [first, { type: "update", data: update("u1") }],
            [first, { type: "update", data: update("u2") }],
            [first, { type: "remove", data: { id: "r1" } }],
            [first, { type: "remove", data: { id: "r2" } }],
        ]);
    });

    it("lists every schema's events in schema order", () => {
        const operation = new BulkPersistChanges();
        operation.resolve(first).removes.push({ id: "r1" } as never);
        operation.resolve(second).adds.push({ id: "a1" } as never);

        expect(toEventArray(eventOf(operation))).toEqual([
            [first, { type: "remove", data: { id: "r1" } }],
            [second, { type: "add", data: { id: "a1" } }],
        ]);
    });

    it("carries a shallow copy of each item rather than the item itself", () => {
        const operation = new BulkPersistChanges();
        const added = { id: "a1" };
        operation.resolve(first).adds.push(added as never);

        const [[, event]] = toEventArray(eventOf(operation));

        expect(event.data).toEqual(added);
        expect(event.data).not.toBe(added);
    });
});
