import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { D1DbPlugin } from '../d1';
import { D1_MAX_BOUND_PARAMETERS, FakeD1Database } from './FakeD1Database';

const items = s.define('d1_large_items', { id: s.string().key(), name: s.string(), note: s.string() }).compile();
const pairs = s.define('d1_large_pairs', { left: s.string().key(), right: s.string().key(), name: s.string() }).compile();

class Store extends DataStore {
    items = this.collection(items).proxy().create();
    pairs = this.collection(pairs).proxy().create();
}

const databases: FakeD1Database[] = [];
const stores: Store[] = [];

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }

    for (const database of databases.splice(0)) {
        database.close();
    }
});

const open = () => {
    const database = new FakeD1Database();
    databases.push(database);
    const store = new Store(new D1DbPlugin(database, { deleteDatabase: async () => undefined }));
    stores.push(store);
    return { store, database };
};

const itemRows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `i${i}`, name: `n${i}`, note: 'x' }));

describe('the fake D1 database', () => {
    it('rejects a statement with more bound parameters than D1 allows', async () => {
        const database = new FakeD1Database();
        databases.push(database);
        const tooMany = Array.from({ length: D1_MAX_BOUND_PARAMETERS + 1 }, (_, i) => i);
        const statement = database.prepare(`SELECT ${tooMany.map(() => '?').join(', ')}`).bind(...tooMany);

        await expect(statement.all()).rejects.toThrow('too many SQL variables');
    });

    it('accepts a statement at exactly the limit', async () => {
        const database = new FakeD1Database();
        databases.push(database);
        const atLimit = Array.from({ length: D1_MAX_BOUND_PARAMETERS }, (_, i) => i);
        const statement = database.prepare(`SELECT ${atLimit.map(() => '?').join(', ')}`).bind(...atLimit);

        await expect(statement.all()).resolves.toBeDefined();
    });
});

describe('D1 saves larger than one statement allows', () => {
    it('adds 1,000 rows', async () => {
        const { store } = open();

        await store.items.addAsync(...itemRows(1000));
        const saved = await store.saveChangesAsync();

        expect(saved.aggregate.adds).toBe(1000);
        expect(await store.items.countAsync()).toBe(1000);
    });

    it('updates 1,000 rows', async () => {
        const { store } = open();
        await store.items.addAsync(...itemRows(1000));
        await store.saveChangesAsync();

        for (const row of await store.items.toArrayAsync()) {
            row.name = `${row.name}!`;
        }
        const saved = await store.saveChangesAsync();

        expect(saved.aggregate.updates).toBe(1000);
        expect(await store.items.where(row => row.name.endsWith('!')).countAsync()).toBe(1000);
    });

    it('removes 1,000 rows', async () => {
        const { store } = open();
        await store.items.addAsync(...itemRows(1000));
        await store.saveChangesAsync();

        await store.items.removeAsync(...await store.items.toArrayAsync());
        const saved = await store.saveChangesAsync();

        expect(saved.aggregate.removes).toBe(1000);
        expect(await store.items.countAsync()).toBe(0);
    });

    it('removes 1,000 rows with a composite key', async () => {
        const { store } = open();
        await store.pairs.addAsync(...Array.from({ length: 1000 }, (_, i) => ({ left: `l${i}`, right: `r${i}`, name: 'x' })));
        await store.saveChangesAsync();

        await store.pairs.removeAsync(...await store.pairs.toArrayAsync());
        await store.saveChangesAsync();

        expect(await store.pairs.countAsync()).toBe(0);
    });

    it('sends the whole save as one batch, so a failing chunk leaves nothing behind', async () => {
        const { store, database } = open();
        await store.items.addAsync({ id: 'i999', name: 'already here', note: 'x' });
        await store.saveChangesAsync();
        const before = database.batches.length;

        const other = new Store(new D1DbPlugin(database, { deleteDatabase: async () => undefined }));
        stores.push(other);
        await other.items.addAsync(...itemRows(1000));

        await expect(other.saveChangesAsync()).rejects.toThrow(/UNIQUE/);
        expect(database.batches.length).toBe(before + 1);
        expect(database.count('d1_large_items')).toBe(1);
    });
});
