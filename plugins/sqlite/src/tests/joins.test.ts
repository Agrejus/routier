import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { SqliteDbPlugin } from '../index';

/**
 * What only a NATIVE join can get wrong.
 *
 * The cross-backend semantics live in `describeJoinContract` (see `joinContract.test.ts`), which
 * this engine passes. Everything here is about the mechanics of turning one flat SQL row back into
 * a pair: column collisions between the two sides, telling "no match" apart from "matched, and its
 * columns are null", JSON columns that have to decode against the right schema, and a window
 * applied before the join.
 *
 * Every case is also run against the memory plugin on the same data. That is the assertion that
 * matters — not that SQLite returns something reasonable, but that it returns the SAME thing.
 */

/** Both sides deliberately share `_id`, `name`, `note` and `tags`: every column collides. */
const leftSchema = s.define("join_left", {
    _id: s.string().key().identity(),
    name: s.string(),
    note: s.string().nullable(),
    tags: s.array(s.string()),
    rightId: s.string().nullable()
}).compile();

const rightSchema = s.define("join_right", {
    _id: s.string().key().identity(),
    name: s.string(),
    note: s.string().nullable(),
    tags: s.array(s.string()),
    payload: s.object({ inner: s.object({ value: s.string() }) })
}).compile();

class JoinStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    lefts = this.collection(leftSchema).proxy().create();
    rights = this.collection(rightSchema).proxy().create();
}

const stores: JoinStore[] = [];

/**
 * The same fixture on two backends, so every assertion can be made twice.
 *
 * `allNull` is the case the left-join rule turns on: a REAL row carrying nothing but empty values.
 * It must come back as an entity, because the test for "no match" is the inner KEY being null — and
 * a matched row cannot have a null key. A check across ALL columns would call this one unmatched.
 */
const seed = async (plugin: IDbPlugin) => {
    const store = new JoinStore(plugin);
    stores.push(store);

    const [matched, allNull] = await store.rights.addAsync(
        { name: "right-matched", note: "right note", tags: ["r1", "r2"], payload: { inner: { value: "deep" } } },
        // Empty rather than null: a nullable `null` does not round-trip identically on every
        // backend (known-defects #66), and that difference is the storage layer's, not the join's.
        { name: "", note: "", tags: [], payload: { inner: { value: "" } } }
    );

    await store.saveChangesAsync();

    await store.lefts.addAsync(
        { name: "left-matched", note: "left note", tags: ["l1"], rightId: matched._id },
        { name: "left-empty-partner", note: "", tags: [], rightId: allNull._id },
        // A null key matches nothing, which is what makes this row the unmatched case
        { name: "left-unmatched", note: "", tags: [], rightId: null }
    );

    await store.saveChangesAsync();

    return store;
};

const onBothBackends = async () => ({
    sqlite: await seed(new SqliteDbPlugin(`join-edges-${uuidv4()}.sqlite`)),
    memory: await seed(new MemoryPlugin(`join-edges-${uuidv4()}`))
});

describe("SQLite native joins", () => {

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    // One flat row carries both sides, so `name` from either table lands in the same slot unless
    // the projection aliases per side. Without that, one half overwrites the other and the pair
    // comes back with the wrong values in it — no error anywhere.
    it("keeps both sides' values when every column name collides", async () => {
        const { sqlite, memory } = await onBothBackends();

        const read = (store: JoinStore) => store.lefts
            .join(s => s.rights, l => l.rightId, r => r._id)
            .sort(([left]) => left.name)
            .map(([left, right]) => `${left.name}/${left.note}/${left.tags.join("-")} :: ${right.name}/${right.note}/${right.tags.join("-")}`)
            .toArrayAsync();

        const fromSqlite = await read(sqlite);

        expect(fromSqlite).toEqual([
            "left-empty-partner// :: //",
            "left-matched/left note/l1 :: right-matched/right note/r1-r2"
        ]);
        expect(fromSqlite).toEqual(await read(memory));
    });

    // The rule the spec singles out: distinguish "no match" from "matched, and its columns are
    // null". A NULL check across all columns would report both as unmatched, silently turning a
    // real row into `undefined`.
    it("tells an unmatched row apart from a matched row whose columns are all null", async () => {
        const { sqlite, memory } = await onBothBackends();

        const read = (store: JoinStore) => store.lefts
            .leftJoin(s => s.rights, l => l.rightId, r => r._id)
            .sort(([left]) => left.name)
            .map(([left, right]) => `${left.name}:${right === undefined ? "undefined" : "entity"}`)
            .toArrayAsync();

        const fromSqlite = await read(sqlite);

        expect(fromSqlite).toEqual([
            "left-empty-partner:entity",
            "left-matched:entity",
            // A null key matches nothing, so this one really is unmatched
            "left-unmatched:undefined"
        ]);
        expect(fromSqlite).toEqual(await read(memory));
    });

    // Nested objects and arrays are stored as JSON columns, and each side has to be decoded
    // against its OWN schema — the outer query's decoding only ever knew the outer one.
    it("decodes each side's JSON columns with its own schema", async () => {
        const { sqlite, memory } = await onBothBackends();

        const read = (store: JoinStore) => store.lefts
            .join(s => s.rights, l => l.rightId, r => r._id)
            .where(([left]) => left.name === "left-matched")
            .map(([left, right]) => ({ leftTags: left.tags, rightTags: right.tags, deep: right.payload.inner.value }))
            .toArrayAsync();

        const fromSqlite = await read(sqlite);

        expect(fromSqlite).toEqual([{ leftTags: ["l1"], rightTags: ["r1", "r2"], deep: "deep" }]);
        expect(fromSqlite).toEqual(await read(memory));
    });

    // SQL applies LIMIT to the JOINED rows, so a window recorded before the join has to become a
    // subquery or it limits the pairs instead of the outer rows — a different question, and one
    // whose answer happens to look plausible.
    it("windows the outer rows when take comes before the join, not the pairs", async () => {
        const { sqlite, memory } = await onBothBackends();

        const read = (store: JoinStore) => store.lefts
            .sort(l => l.name)
            .take(2)
            .leftJoin(s => s.rights, l => l.rightId, r => r._id)
            .sort(([left]) => left.name)
            .map(([left]) => left.name)
            .toArrayAsync();

        const fromSqlite = await read(sqlite);

        // The first two LEFTS by name, then paired — not the first two pairs
        expect(fromSqlite).toEqual(["left-empty-partner", "left-matched"]);
        expect(fromSqlite).toEqual(await read(memory));
    });

    it("filters the outer side in SQL before joining", async () => {
        const { sqlite, memory } = await onBothBackends();

        const read = (store: JoinStore) => store.lefts
            .where(l => l.name === "left-matched")
            .join(s => s.rights, l => l.rightId, r => r._id)
            .map(([left, right]) => `${left.name}:${right.name}`)
            .toArrayAsync();

        const fromSqlite = await read(sqlite);

        expect(fromSqlite).toEqual(["left-matched:right-matched"]);
        expect(fromSqlite).toEqual(await read(memory));
    });

    // A join against a collection nothing has written yet is a legitimate query with no pairs.
    // "no such table" is not the right answer, so both tables are created on demand.
    it("returns no pairs rather than failing when a table does not exist yet", async () => {
        const store = new JoinStore(new SqliteDbPlugin(`join-empty-${uuidv4()}.sqlite`));
        stores.push(store);

        expect(await store.lefts.join(s => s.rights, l => l.rightId, r => r._id).toArrayAsync()).toEqual([]);
    });
});
