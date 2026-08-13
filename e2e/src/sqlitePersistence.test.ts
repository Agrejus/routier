import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';

/**
 * Durability against a real SQLite file.
 *
 * In-process suites cannot show this: a memory plugin's "reopen" is the same object graph,
 * so a store that never actually wrote to disk still passes. Here the store is closed, the
 * process-level handle dropped, and a brand new plugin opened against the same file — the
 * only way to prove the bytes landed.
 */

const schema = s.define('e2e_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(schema).proxy().create();
}

const files: string[] = [];

/** A SQLite file path in a temp directory, tracked for cleanup. */
function databaseFile() {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'routier-e2e-')), `${uuidv4()}.sqlite`);
    files.push(file);
    return file;
}

/** Opens a store against an existing file, as a fresh process would. */
/**
 * Opened stores, disposed in `afterEach`. Constructing a DataStore opens a BroadcastChannel
 * pair per collection — two MessagePort handles that hold the Node event loop open whether
 * or not anything subscribes — so leaving them is what makes a run need `--forceExit`.
 */
const stores: ProductStore[] = [];

const open = (file: string) => {
    const store = new ProductStore(new SqliteDbPlugin(file));
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

describe('SQLite persistence across restart', () => {
    it('writes rows that a newly opened store can read', async () => {
        const file = databaseFile();

        const first = open(file);
        await first.products.addAsync(
            { name: 'Alpha', category: 'tools', price: 10 } as any,
            { name: 'Bravo', category: 'toys', price: 20 } as any,
        );
        await first.saveChangesAsync();

        // A second plugin instance against the same path — no shared in-memory state.
        const second = open(file);

        expect(await second.products.countAsync()).toBe(2);
    });

    it('creates a file on disk rather than keeping data in memory', async () => {
        const file = databaseFile();

        const store = open(file);
        await store.products.addAsync({ name: 'Alpha', category: 'tools', price: 10 } as any);
        await store.saveChangesAsync();

        expect(fs.existsSync(file)).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(0);
    });

    it('preserves values, not just row count', async () => {
        const file = databaseFile();

        const first = open(file);
        await first.products.addAsync({ name: 'Alpha', category: 'tools', price: 10 } as any);
        await first.saveChangesAsync();

        const reopened = await open(file).products.firstAsync(p => p.name === 'Alpha');

        expect(reopened.category).toBe('tools');
        expect(reopened.price).toBe(10);
    });

    it('preserves generated identities across a restart', async () => {
        const file = databaseFile();

        const first = open(file);
        const [added] = await first.products.addAsync({ name: 'Alpha', category: 'tools', price: 10 } as any);
        await first.saveChangesAsync();
        const assignedId = added._id;

        const reopened = await open(file).products.firstAsync(p => p.name === 'Alpha');

        // A restart that reassigns ids would break every stored reference to this row.
        expect(reopened._id).toBe(assignedId);
    });

    it('persists an update made by a later store instance', async () => {
        const file = databaseFile();

        const first = open(file);
        await first.products.addAsync({ name: 'Alpha', category: 'tools', price: 10 } as any);
        await first.saveChangesAsync();

        const second = open(file);
        const found = await second.products.firstAsync(p => p.name === 'Alpha');
        found.price = 99;
        await second.saveChangesAsync();

        expect((await open(file).products.firstAsync(p => p.name === 'Alpha')).price).toBe(99);
    });

    it('persists a removal made by a later store instance', async () => {
        const file = databaseFile();

        const first = open(file);
        await first.products.addAsync({ name: 'Alpha', category: 'tools', price: 10 } as any);
        await first.saveChangesAsync();

        const second = open(file);
        await second.products.removeAsync(await second.products.firstAsync(p => p.name === 'Alpha'));
        await second.saveChangesAsync();

        expect(await open(file).products.countAsync()).toBe(0);
    });

    it('keeps separate database files isolated', async () => {
        const one = databaseFile();
        const other = databaseFile();

        const first = open(one);
        await first.products.addAsync({ name: 'Alpha', category: 'tools', price: 10 } as any);
        await first.saveChangesAsync();

        expect(await open(other).products.countAsync()).toBe(0);
    });

    it('reports an empty collection for a database file that does not exist yet', async () => {
        expect(await open(databaseFile()).products.countAsync()).toBe(0);
    });
});
