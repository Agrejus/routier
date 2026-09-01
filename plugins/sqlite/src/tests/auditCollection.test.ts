import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

/**
 * `.audit().derive()` against an engine that has to create the table and bind the values.
 *
 * Two things only a real engine shows: that the audit table's DDL happens (it is an ordinary
 * declared collection now, so it should), and that the emitted rows are storage-shaped. The
 * rows never pass through a collection's write path, so whatever `derive` returns is what the
 * driver is asked to bind — a `Date` reaching SQLite unserialized fails outright, and a
 * timestamp is the one column an audit table always has.
 */

const productSchema = s.define('audited_sqlite_products', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

const historySchema = s.define('audited_sqlite_history', {
    id: s.string().key().identity(),
    operation: s.string(),
    at: s.date().deserialize(x => new Date(x as string)),
}).compile();

class Store extends DataStore {
    history = this.collection(historySchema).proxy().create();

    products = this.collection(productSchema)
        .audit(historySchema)
        .derive((changes, cb) => cb(changes.map(c => ({ operation: c.operation, at: c.at }))))
        .proxy()
        .create();
}

const stores: DataStore[] = [];

const open = () => {
    const store = new Store(new SqliteDbPlugin(`audit-collection-${uuidv4()}.sqlite`));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch((): undefined => undefined);
    }
});

describe('collection.audit() on SQLite', () => {

    it('creates the audit table and writes to it', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync();

        expect(rows).toHaveLength(1);
        expect(rows[0].operation).toBe('add');
        expect(rows[0].at).toBeInstanceOf(Date);
    });

    it('records a full add, update and remove cycle', async () => {
        const store = open();

        const [product] = await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        product.price = 2;
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        const operations = (await store.history.toArrayAsync()).map(r => r.operation).sort();

        expect(operations).toEqual(['add', 'remove', 'update']);
    });

    it('writes the audit row in the same save as the change', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(1);
        expect(await store.history.countAsync()).toBe(1);
    });
});
