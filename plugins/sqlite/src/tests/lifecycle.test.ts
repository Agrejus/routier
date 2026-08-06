import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

/**
 * Connection, transaction and cache lifecycle — the three things the plugin got wrong in
 * ways no behavioural test could see.
 *
 * Each defect produced correct-looking results. A leaked connection still answers queries; a
 * transaction that never began still applies its statements; a cross-file DDL cache still
 * creates *a* table. They are only observable by watching handles, by making the lock
 * contended, or by pointing two schemas at one collection name.
 */

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-lifecycle-'));

const dirs: string[] = [];
const stores: DataStore[] = [];

const databaseFile = () => {
    const dir = tempDir();
    dirs.push(dir);
    return path.join(dir, `${uuidv4()}.sqlite`);
};

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }

    for (const dir of dirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

describe('SQLite connection lifecycle', () => {
    const schema = s.define('lifecycle_rows', {
        id: s.string().key(),
        value: s.string(),
    }).compile();

    class Store extends DataStore {
        rows = this.collection(schema).proxy().create();
    }

    const open = (file: string) => track(new Store(new SqliteDbPlugin(file)));

    it('does not accumulate file handles across many queries', async () => {
        const file = databaseFile();
        const store = open(file);

        await store.rows.addAsync({ id: 'a', value: 'v' } as any);
        await store.saveChangesAsync();

        // Each query used to open a `sqlite3.Database` and never close it — the
        // `shouldClose` parameter defaulted to false and no caller passed it. Fifty
        // queries meant fifty retained handles.
        const before = process.getActiveResourcesInfo().length;

        for (let i = 0; i < 50; i++) {
            await store.rows.countAsync();
        }

        const after = process.getActiveResourcesInfo().length;

        expect(after - before).toBeLessThan(10);
    });

    it('still answers queries after many sequential opens and closes', async () => {
        // Closing per operation must not break the next one — the risk of the fix.
        const file = databaseFile();
        const store = open(file);

        await store.rows.addAsync({ id: 'a', value: 'first' } as any);
        await store.saveChangesAsync();

        for (let i = 0; i < 10; i++) {
            expect(await store.rows.countAsync()).toBe(1);
        }

        const found = await store.rows.firstAsync(r => r.id === 'a');
        expect(found.value).toBe('first');
    });

    it('reports a query error rather than hanging once the connection is closed', async () => {
        // A close on the error path that swallowed `done` would turn every failure into a
        // hang. Query a file the process cannot open.
        const store = track(new Store(new SqliteDbPlugin(path.join(databaseFile(), 'not-a-directory', 'x.sqlite'))));

        const outcome = await store.rows.countAsync().then(() => 'resolved', () => 'rejected');

        expect(outcome).toBe('rejected');
    });
});

describe('SQLite DDL cache scope', () => {
    // Two schemas that share a collection name but not their columns. Under a module-global
    // cache keyed by collection name, whichever plugin ran first supplied the CREATE TABLE
    // for both files, so the second database was created with the wrong columns.
    const first = s.define('shared_name_rows', {
        id: s.string().key(),
        alpha: s.string(),
    }).compile();

    const second = s.define('shared_name_rows', {
        id: s.string().key(),
        beta: s.number(),
    }).compile();

    class FirstStore extends DataStore {
        rows = this.collection(first).proxy().create();
    }

    class SecondStore extends DataStore {
        rows = this.collection(second).proxy().create();
    }

    it('gives two files with the same collection name their own DDL', async () => {
        const fileA = databaseFile();
        const fileB = databaseFile();

        const a = track(new FirstStore(new SqliteDbPlugin(fileA)));
        await a.rows.addAsync({ id: '1', alpha: 'x' } as any);
        await a.saveChangesAsync();

        const b = track(new SecondStore(new SqliteDbPlugin(fileB)));
        await b.rows.addAsync({ id: '1', beta: 42 } as any);
        await b.saveChangesAsync();

        // If B's table had been created from A's cached DDL it would have an `alpha`
        // column and no `beta`, and this write would have been lost or rejected.
        const [row] = await b.rows.toArrayAsync();
        expect(row.beta).toBe(42);

        const [other] = await a.rows.toArrayAsync();
        expect(other.alpha).toBe('x');
    });

    it('keeps each plugin instance independent for the same file', async () => {
        const file = databaseFile();

        const a = track(new FirstStore(new SqliteDbPlugin(file)));
        await a.rows.addAsync({ id: '1', alpha: 'x' } as any);
        await a.saveChangesAsync();

        // A second instance over the SAME file re-derives rather than inheriting, and must
        // still see the persisted row.
        const b = track(new FirstStore(new SqliteDbPlugin(file)));
        expect(await b.rows.countAsync()).toBe(1);
    });
});

describe('SQLite transaction start', () => {
    const schema = s.define('begin_rows', {
        id: s.string().key(),
        value: s.string(),
    }).compile();

    class Store extends DataStore {
        rows = this.collection(schema).proxy().create();
    }

    it('fails the save when the transaction cannot begin', async () => {
        // A directory where the file should be: sqlite3 can "open" it lazily but every
        // statement, BEGIN IMMEDIATE first, fails. Before the fix BEGIN's error was
        // discarded and execution continued with no transaction open.
        const dir = tempDir();
        dirs.push(dir);
        const asDirectory = path.join(dir, 'database.sqlite');
        fs.mkdirSync(asDirectory);

        const store = track(new Store(new SqliteDbPlugin(asDirectory)));
        await store.rows.addAsync({ id: 'a', value: 'v' } as any);

        const outcome = await store.saveChangesAsync().then(() => 'resolved', (e) => e);

        expect(outcome).not.toBe('resolved');
    });

    it('commits normally when the transaction can begin', async () => {
        const file = databaseFile();
        const store = track(new Store(new SqliteDbPlugin(file)));

        await store.rows.addAsync({ id: 'a', value: 'v' } as any);
        await store.saveChangesAsync();

        expect(await track(new Store(new SqliteDbPlugin(file))).rows.countAsync()).toBe(1);
    });
});
