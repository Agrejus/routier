import { afterEach, describe, expect, it } from '@jest/globals';
import { AuditLogDbPlugin, type AuditChange } from '@routier/core/plugins';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

/**
 * The audit wrapper against a backend that has to CREATE the table.
 *
 * The memory plugin proves the rows are routed; only a SQL engine proves the schema handed
 * down is enough to build a table from. The wrapper never issues DDL itself — it makes the
 * audit schema resolvable through `schemas.get`, and the plugin's ordinary lazy creation does
 * the rest. If that seam is wrong, the first save fails with "no such table" rather than
 * silently doing nothing, which is why one real engine is worth the round trip.
 */

const productSchema = s.define('wrapped_products', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

const historySchema = s.define('wrapped_history', {
    id: s.string().key().identity(),
    collection: s.string(),
    operation: s.string(),
    at: s.date().deserialize(x => new Date(x as string)),
}).compile();

class Store extends DataStore {
    products = this.collection(productSchema).proxy().create();
    history = this.collection(historySchema).proxy().create();
}

const stores: DataStore[] = [];

const open = () => {
    const store = new Store(new AuditLogDbPlugin(new SqliteDbPlugin(`audit-${uuidv4()}.sqlite`), {
        schema: historySchema,
        entry: (change: AuditChange) => ({
            collection: change.collection,
            operation: change.operation,
            at: change.at,
        }),
    }));

    stores.push(store);

    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('AuditLogDbPlugin on SQLite', () => {

    it('creates the audit table on the first save', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync();

        expect(rows).toHaveLength(1);
        expect(rows[0].collection).toBe('wrapped_products');
        expect(rows[0].operation).toBe('add');
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

    it('writes the audit row in the same save as the change it describes', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        // Both landed from one saveChanges. On an engine with an atomic batch that means they
        // commit together — a trail that can disagree with the data is worse than none.
        expect(await store.products.countAsync()).toBe(1);
        expect(await store.history.countAsync()).toBe(1);
    });
});
