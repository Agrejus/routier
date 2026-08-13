import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';

/**
 * A `null` written to a nullable property has to come back as `null` — known-defects #66.
 *
 * Every read here goes through a SECOND store over the same database. Reading through the store
 * that did the write proves nothing: the change tracker merges the result into the canonical
 * entity the caller still holds, so the caller's own `null` is what you see, whatever storage
 * actually returned. That is what hid this for so long.
 */
const schema = s.define("null_round_trip", {
    id: s.string().key(),
    note: s.string().nullable(),
    count: s.number().nullable(),
    when: s.date().nullable(),
    tags: s.array(s.string()).nullable(),
    maybe: s.string().optional(),
}).compile();

class NullStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    rows = this.collection(schema).proxy().create();
}

const stores: NullStore[] = [];

const open = (databaseName: string) => {
    const store = new NullStore(new MemoryPlugin(databaseName));
    stores.push(store);
    return store;
};

describe("null round trip", () => {

    afterAll(async () => {
        // One destroy per database: MemoryPlugin's registry is keyed by name, so destroying
        // through either store clears it for both.
        await Promise.all(stores.map(store => store.destroyAsync().catch(() => undefined)));
    });

    it("reads an explicit null back as null, not undefined", async () => {
        const databaseName = `null-${uuidv4()}`;

        const writer = open(databaseName);
        await writer.rows.addAsync({ id: "a", note: null, count: null, when: null, tags: null });
        await writer.saveChangesAsync();

        const [row] = await open(databaseName).rows.toArrayAsync();

        expect(row.note).toBeNull();
        expect(row.count).toBeNull();
        expect(row.when).toBeNull();
        expect(row.tags).toBeNull();
    });

    // The reader that found the defect: a join result is a read-only projection with no change
    // tracking, so nothing merges and storage answers for itself.
    it("reads null back as null through a join, which has no change tracking to hide it", async () => {
        const databaseName = `null-join-${uuidv4()}`;

        const writer = open(databaseName);
        await writer.rows.addAsync({ id: "a", note: null, count: null, when: null, tags: null });
        await writer.saveChangesAsync();

        const store = open(databaseName);
        const [[left, right]] = await store.rows
            .join(s => s.rows, r => r.id, r => r.id)
            .toArrayAsync();

        expect(left.note).toBeNull();
        expect(right.note).toBeNull();
        expect(right.tags).toBeNull();
    });

    it("leaves an absent optional property absent", async () => {
        const databaseName = `null-absent-${uuidv4()}`;

        const writer = open(databaseName);
        await writer.rows.addAsync({ id: "a", note: null, count: null, when: null, tags: null });
        await writer.saveChangesAsync();

        const [row] = await open(databaseName).rows.toArrayAsync();

        expect(row.maybe).toBeUndefined();
    });
});
