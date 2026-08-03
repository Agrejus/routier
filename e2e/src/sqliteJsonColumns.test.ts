import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';

/**
 * Nested objects and arrays through a real SQLite file, with **no schema serializers**.
 *
 * This is the case that did not work before `toColumnAssignments`/`decodeJsonColumns`. The
 * DDL already declared a JSON column for a nested property, but the write path bound the raw
 * object as a parameter and the read path never parsed it back — so a schema that did not
 * hand-roll `.serialize(JSON.stringify).deserialize(JSON.parse)` simply could not store
 * nested data. Every existing test that exercised arrays on SQLite carried those modifiers,
 * which is why the gap stayed invisible.
 *
 * It has to be an e2e test against a real file. The whole question is what the driver does
 * with the bound parameter and what comes back out of the column, and an in-process plugin
 * answers neither.
 */

const schema = s.define('e2e_json_columns', {
    _id: s.string().key().identity(),
    name: s.string(),
    // No .serialize()/.deserialize() anywhere below — that is the point.
    nested: s.object({ inner: s.object({ value: s.string(), count: s.number() }) }),
    tags: s.array(s.string()),
    scores: s.array(s.number()),
}).compile();

class JsonStore extends DataStore {
    items = this.collection(schema).create();
}

const files: string[] = [];

const databaseFile = () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'routier-json-')), `${uuidv4()}.sqlite`);
    files.push(file);
    return file;
};

/**
 * Opened stores, disposed in `afterEach`. Constructing a DataStore opens a BroadcastChannel
 * pair per collection — two MessagePort handles that hold the Node event loop open whether
 * or not anything subscribes — so leaving them is what makes a run need `--forceExit`.
 */
const stores: JsonStore[] = [];

const open = (file: string) => {
    const store = new JsonStore(new SqliteDbPlugin(file));
    stores.push(store);
    return store;
};

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }

    for (const file of files.splice(0)) {
        fs.rmSync(path.dirname(file), { recursive: true, force: true });
    }
});

describe('SQLite JSON columns without schema serializers', () => {
    it('round-trips a nested object on insert', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.items.addAsync({
            name: 'alpha',
            nested: { inner: { value: 'deep', count: 3 } },
            tags: ['a', 'b'],
            scores: [1, 2, 3],
        } as any);
        await store.saveChangesAsync();

        const found: any = await open(file).items.firstAsync();

        expect(found.nested).toEqual({ inner: { value: 'deep', count: 3 } });
        expect(found.tags).toEqual(['a', 'b']);
        expect(found.scores).toEqual([1, 2, 3]);
    });

    it('gives back a real object, not a JSON string', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.items.addAsync({
            name: 'alpha', nested: { inner: { value: 'deep', count: 1 } }, tags: [], scores: [],
        } as any);
        await store.saveChangesAsync();

        const found: any = await open(file).items.firstAsync();

        // The pre-fix failure mode: the column's JSON arrived as a string and any property
        // access on it silently produced undefined.
        expect(typeof found.nested).toBe('object');
        expect(found.nested.inner.value).toBe('deep');
        expect(Array.isArray(found.tags)).toBe(true);
    });

    it('persists an update to a nested value two levels deep', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.items.addAsync({
            name: 'alpha', nested: { inner: { value: 'before', count: 1 } }, tags: ['x'], scores: [1],
        } as any);
        await store.saveChangesAsync();

        const second = open(file);
        const found: any = await second.items.firstAsync();

        second.items.update(found, { nested: { inner: { value: 'after' } } });
        await second.saveChangesAsync();

        const reread: any = await open(file).items.firstAsync();

        expect(reread.nested.inner.value).toBe('after');
        // The sibling inside the same JSON column must survive a partial patch.
        expect(reread.nested.inner.count).toBe(1);
    });

    it('persists a replaced array', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.items.addAsync({
            name: 'alpha', nested: { inner: { value: 'v', count: 1 } }, tags: ['old'], scores: [1],
        } as any);
        await store.saveChangesAsync();

        const second = open(file);
        second.items.update(await second.items.firstAsync(), { tags: ['new', 'newer'] });
        await second.saveChangesAsync();

        expect((await open(file).items.firstAsync() as any).tags).toEqual(['new', 'newer']);
    });

    it('persists an emptied array as empty, not null', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.items.addAsync({
            name: 'alpha', nested: { inner: { value: 'v', count: 1 } }, tags: ['gone'], scores: [1],
        } as any);
        await store.saveChangesAsync();

        const second = open(file);
        second.items.update(await second.items.firstAsync(), { tags: [] });
        await second.saveChangesAsync();

        const reread: any = await open(file).items.firstAsync();

        expect(Array.isArray(reread.reread ?? reread.tags)).toBe(true);
        expect(reread.tags).toEqual([]);
    });

    it('keeps rows independent across many nested values', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.items.addAsync(
            ...Array.from({ length: 50 }, (_, i) => ({
                name: `n${i}`,
                nested: { inner: { value: `v${i}`, count: i } },
                tags: [`t${i}`],
                scores: [i, i + 1],
            })) as any[]
        );
        await store.saveChangesAsync();

        const all: any[] = await open(file).items.toArrayAsync();

        expect(all.length).toBe(50);

        const mismatched = all.find(row => {
            const i = Number(row.name.slice(1));
            return row.nested.inner.value !== `v${i}`
                || row.nested.inner.count !== i
                || row.tags[0] !== `t${i}`
                || row.scores[1] !== i + 1;
        });

        expect(mismatched == null ? 'all rows intact' : `row ${mismatched.name} is wrong`)
            .toBe('all rows intact');
    });
});
