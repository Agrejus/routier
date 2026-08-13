import { afterEach, describe, expect, it } from '@jest/globals';
import { ConcurrencyDbPlugin } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { describePluginContract, describeVectorSearch } from '@routier/test-utils';
import { D1DbPlugin } from '../d1';
import { FakeD1Database } from './FakeD1Database';

/**
 * The D1 plugin, whose only difference from the SQLite plugin is the shape of execution.
 *
 * The statements are already covered — they are the same ones `utils.ts` builds for every
 * other SQLite engine. What is new is that a save must arrive as ONE batch with the DDL
 * prepended, and that the two things `batch()` makes impossible are refused rather than
 * skipped. Those are what the cases below are about; the contract runs to prove the batch
 * shape did not break anything the interactive path could do.
 */

const databases: FakeD1Database[] = [];

const open = () => {
    const database = new FakeD1Database();
    databases.push(database);
    return database;
};

afterEach(() => {
    for (const database of databases.splice(0)) {
        database.close();
    }
});

describePluginContract(
    'cloudflare d1',
    () => new D1DbPlugin(open(), { deleteDatabase: async () => undefined }),
    {
        // Same reasoning as the SQLite plugin: SQLite has no native boolean, date, array or
        // object column type, and D1 inherits that.
        supportsRichTypes: false,
        knownFailing: [],
    },
);

describeVectorSearch(
    'cloudflare d1',
    () => new D1DbPlugin(open(), { deleteDatabase: async () => undefined }),
);

const productSchema = s.define('d1_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

describe('D1 batch shape', () => {

    it('sends one batch per save, with the table creation inside it', async () => {
        const database = open();
        const store = new ProductStore(new D1DbPlugin(database));

        await store.products.addAsync({ name: 'a', price: 1 } as any, { name: 'b', price: 2 } as any);
        await store.saveChangesAsync();

        // One batch: the CREATE TABLE and the INSERT. Two batches would mean the DDL went
        // separately, which costs a round trip and — on a real binding — is not atomic with
        // the write it exists for.
        expect(database.batches).toEqual([2]);
        expect(database.executed.some(sql => sql.startsWith('CREATE TABLE'))).toBe(true);
    });

    it('creates the table without an interactive retry', async () => {
        const database = open();
        const store = new ProductStore(new D1DbPlugin(database));

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        // The SQLite plugin discovers a missing table by failing, creating it, and running the
        // statement again. A batch cannot do that, so the CREATE has to be unconditional — and
        // therefore emitted exactly once, not once per attempt.
        const creates = database.executed.filter(sql => sql.startsWith('CREATE TABLE'));

        expect(creates).toHaveLength(1);
        expect(creates[0]).toContain('IF NOT EXISTS');
    });

    it('applies nothing when one statement in the batch fails', async () => {
        const database = open();
        const store = new ProductStore(new D1DbPlugin(database));

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        expect(database.count('d1_products')).toBe(1);

        // A second batch whose second statement is invalid. Atomicity is the property the
        // whole design rests on: without it a half-applied save is worse than a failed one,
        // because the change tracker believes none of it landed.
        const failing = [
            database.prepare(`INSERT INTO "d1_products" ("_id", "name", "price") VALUES (?, ?, ?)`).bind('x', 'c', 3),
            database.prepare(`INSERT INTO "nope" ("a") VALUES (?)`).bind(1),
        ];

        await expect(database.batch(failing)).rejects.toThrow();
        expect(database.count('d1_products')).toBe(1);
    });
});

describe('D1 refusals', () => {

    it('refuses to be wrapped in ConcurrencyDbPlugin', async () => {
        const store = new ProductStore(new ConcurrencyDbPlugin(new D1DbPlugin(open())));

        await store.products.addAsync({ name: 'a', price: 1 } as any);

        // Named at the first save rather than at the first race. A conflict check that
        // silently did not happen looks exactly like one that passed.
        await expect(store.saveChangesAsync()).rejects.toThrow(/optimistic concurrency/i);
    });

    it('refuses a read through ConcurrencyDbPlugin too', async () => {
        const store = new ProductStore(new ConcurrencyDbPlugin(new D1DbPlugin(open())));

        // The composition is wrong, not just its writes. Refusing on the first query surfaces
        // it during development instead of under contention.
        await expect(store.products.toArrayAsync()).rejects.toThrow(/optimistic concurrency/i);
    });

    it('refuses to drop the database unless the caller opts in', async () => {
        const store = new ProductStore(new D1DbPlugin(open()));

        // A binding cannot tell a scratch database from production, and the operation does not
        // come back. Same decision as the Turso driver.
        await expect(store.destroyAsync()).rejects.toThrow(/will not drop a database/i);
    });

    it('drops the database when the caller supplies the teardown', async () => {
        let dropped = false;
        const store = new ProductStore(new D1DbPlugin(open(), {
            deleteDatabase: async () => { dropped = true; },
        }));

        await store.destroyAsync();

        expect(dropped).toBe(true);
    });
});
