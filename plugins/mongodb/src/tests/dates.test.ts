import { beforeEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { executedQueriesOf } from "@routier/core/plugins";
import { CallExpression, ComparatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { MongoDbPlugin } from "../MongoDbPlugin";
import { toMql } from "../mql";
import { FakeMongoCollection, FakeMongoDriver } from "./FakeMongoDriver";

/**
 * Dates, over documents as the plugin stores them.
 *
 * The datastore serializes a Date to its ISO string before the plugin inserts it, so a document holds
 * the string. A filter value has to be sent the same way to match, and the options the plugin runs in
 * JavaScript have to see Dates again. Mid-year dates, so a local-time `getFullYear()` gives the same
 * year in every timezone.
 */

const events = s.define("events", {
    _id: s.string().key().identity(),
    label: s.string(),
    createdDate: s.date(),
    dueDate: s.date().from("wire_due"),
}).compile();

class EventStore extends DataStore {
    events = this.collection(events).proxy().create();
}

const plainEvents = s.define("plain_events", {
    _id: s.string().key().identity(),
    label: s.string(),
    createdDate: s.date(),
}).compile();

class PlainEventStore extends DataStore {
    events = this.collection(plainEvents).proxy().create();
}

const ROWS = [
    { label: "alpha", createdDate: new Date("2024-06-15T00:00:00.000Z"), dueDate: new Date("2026-06-15T00:00:00.000Z") },
    { label: "bravo", createdDate: new Date("2023-06-15T00:00:00.000Z"), dueDate: new Date("2022-06-15T00:00:00.000Z") },
    { label: "charlie", createdDate: new Date("2025-06-15T00:00:00.000Z"), dueDate: new Date("2021-06-15T00:00:00.000Z") },
];

describe("MongoDbPlugin dates", () => {

    let driver: FakeMongoDriver;

    beforeEach(() => {
        driver = new FakeMongoDriver();
    });

    /** A store that did not save the rows, so every answer comes from documents as stored. */
    const seeded = async () => {
        const writer = new EventStore(new MongoDbPlugin(driver));

        await writer.events.addAsync(...(ROWS as any));
        await writer.saveChangesAsync();

        return new EventStore(new MongoDbPlugin(driver));
    };

    const labels = (rows: { label: string }[]) => rows.map(row => row.label).sort();

    it("stores a date as the ISO string the datastore serialized it to", async () => {
        await seeded();

        const [document] = (driver.collections.get("events") as FakeMongoCollection).documents;

        expect(document.createdDate).toBe("2024-06-15T00:00:00.000Z");
        expect(document.wire_due).toBe("2026-06-15T00:00:00.000Z");
    });

    it("renders a Date value as the ISO string a document holds, in a field predicate, $in and $literal", () => {
        const createdDate = events.getProperty("createdDate");
        const date = (iso: string) => new ValueExpression({ value: new Date(iso) });

        expect(toMql(new ComparatorExpression({
            comparator: "greater-than", negated: false, strict: false,
            left: new PropertyExpression({ property: createdDate }), right: date("2024-01-01T00:00:00.000Z")
        }))).toEqual({ createdDate: { $gt: "2024-01-01T00:00:00.000Z" } });

        expect(toMql(new ComparatorExpression({
            comparator: "includes", negated: true, strict: false,
            left: new ValueExpression({ value: [new Date("2024-06-15T00:00:00.000Z")] }), right: new PropertyExpression({ property: createdDate })
        }))).toEqual({ createdDate: { $nin: ["2024-06-15T00:00:00.000Z"] } });

        // Two properties force `$expr`, where the other literal is a `$literal`
        expect(JSON.stringify(toMql(new ComparatorExpression({
            comparator: "equals", negated: false, strict: false,
            left: new CallExpression({ call: "coalesce", expression: new PropertyExpression({ property: createdDate }), arguments: [date("2020-01-01T00:00:00.000Z")] }),
            right: new PropertyExpression({ property: events.getProperty("dueDate") })
        })))).toContain('{"$literal":"2020-01-01T00:00:00.000Z"}');
    });

    it("filters on a date against a Date parameter, on the server", async () => {
        const { data, explanation } = await (await seeded()).events
            .where(([r, p]) => r.createdDate > p.d, { d: new Date("2024-01-01T00:00:00.000Z") })
            .explain()
            .toArrayAsync();

        expect(labels(data)).toEqual(["alpha", "charlie"]);
        expect(explanation.summary.memory).toBe(0);
        expect(executedQueriesOf(explanation)[0].text).toContain('{"createdDate":{"$gt":"2024-01-01T00:00:00.000Z"}}');
    });

    it("filters on a date against a Date constructed in the filter, which runs in memory", async () => {
        // `new Date(...)` is not in the filter grammar, so this is the datastore's, over deserialized rows
        const found = await (await seeded()).events.where(r => r.createdDate > new Date("2024-01-01T00:00:00.000Z")).toArrayAsync();

        expect(labels(found)).toEqual(["alpha", "charlie"]);
    });

    it("filters on a date against a parameter, and on a renamed date", async () => {
        const store = await seeded();

        expect(labels(await store.events.where(([r, p]) => r.createdDate > p.d, { d: new Date("2024-01-01T00:00:00.000Z") }).toArrayAsync())).toEqual(["alpha", "charlie"]);
        expect(labels(await store.events.where(([r, p]) => r.dueDate > p.d, { d: new Date("2022-01-01T00:00:00.000Z") }).toArrayAsync())).toEqual(["alpha", "bravo"]);
        expect(labels(await store.events.where(r => r.dueDate <= new Date("2022-06-15T00:00:00.000Z")).toArrayAsync())).toEqual(["bravo", "charlie"]);
    });

    it("filters on a date's membership in a list of Dates, with $in and $nin", async () => {
        const store = await seeded();
        const dates = [ROWS[0].createdDate, ROWS[2].createdDate];

        const { data, explanation } = await store.events
            .where(([r, p]) => p.dates.includes(r.createdDate), { dates })
            .explain()
            .toArrayAsync();

        expect(labels(data)).toEqual(["alpha", "charlie"]);
        expect(executedQueriesOf(explanation)[0].text).toContain('"$in":["2024-06-15T00:00:00.000Z","2025-06-15T00:00:00.000Z"]');
        expect(labels(await store.events.where(([r, p]) => !p.dates.includes(r.createdDate), { dates }).toArrayAsync())).toEqual(["bravo"]);
    });

    it("sorts by a date on the server", async () => {
        const found = await (await seeded()).events.sort(r => r.createdDate).toArrayAsync();

        expect(found.map(row => row.label)).toEqual(["bravo", "alpha", "charlie"]);
    });

    /**
     * Over a schema with nothing renamed. A group copies every property into its members, so one renamed
     * property hands the whole group back, and the datastore groups deserialized rows; this one runs here.
     */
    it("groups by a date, and by a date's year, over documents it groups itself", async () => {
        const writer = new PlainEventStore(new MongoDbPlugin(driver));

        await writer.events.addAsync(...(ROWS.map(({ label, createdDate }) => ({ label, createdDate })) as any));
        await writer.saveChangesAsync();

        const reader = new PlainEventStore(new MongoDbPlugin(driver));
        const { data, explanation } = await reader.events.explain().toGroupAsync(r => r.createdDate as never);
        const groups = data as unknown as Record<string, { label: string, createdDate: Date }[]>;

        expect(explanation.summary.memory).toBe(0);
        expect(Object.entries(groups).map(([key, rows]) => [key, labels(rows)]).sort()).toEqual(
            ROWS.map(row => [String(row.createdDate), [row.label]]).sort()
        );
        expect(Object.values(groups).flat().every(row => row.createdDate instanceof Date)).toBe(true);

        // Cast because a group key is typed as a property's value
        const byYear = await reader.events.toGroupAsync(r => r.createdDate.getFullYear() as never) as unknown as Record<string, unknown[]>;

        expect(Object.keys(byYear).sort()).toEqual(["2023", "2024", "2025"]);
    });

    it("maps a date's year, and a renamed date's year", async () => {
        const store = await seeded();

        expect([...await store.events.map(r => r.createdDate.getFullYear()).toArrayAsync()].sort()).toEqual([2023, 2024, 2025]);
        expect([...await store.events.map(r => r.dueDate.getFullYear()).toArrayAsync()].sort()).toEqual([2021, 2022, 2026]);
    });

    it("reads every date back as a Date", async () => {
        const found = await (await seeded()).events.sort(r => r.label).toArrayAsync();

        expect(found.map(row => row.createdDate.toISOString())).toEqual(ROWS.map(row => row.createdDate.toISOString()));
        expect(found.map(row => row.dueDate.toISOString())).toEqual(ROWS.map(row => row.dueDate.toISOString()));
    });
});
