import { afterEach, describe, expect, it } from '@jest/globals';
import { AuditLogDbPlugin, type AuditChange } from '@routier/core/plugins';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { describePluginContract } from '@routier/test-utils';
import { MemoryPlugin } from '../MemoryPlugin';

/**
 * The audit wrapper end to end: the rows have to be written by a real backend, into a table it
 * was never told about except through the schema the wrapper hands down.
 *
 * The caller declares the table's shape, so the schema below is deliberately not a shape the
 * wrapper could have guessed — it renames the fields and stores the delta as text — to prove
 * the mapping is genuinely the caller's.
 */

const productSchema = s.define('audit_products', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

const historySchema = s.define('audit_history', {
    id: s.string().key().identity(),
    what: s.string(),
    how: s.string(),
    which: s.string().nullable(),
    changed: s.string(),
    when: s.date(),
}).compile();

type HistoryRow = { what: string, how: string, which: string | null, changed: string, when: Date };

const entry = (change: AuditChange) => ({
    what: change.collection,
    how: change.operation,
    which: change.id == null ? null : String(change.id),
    changed: JSON.stringify(change.delta ?? {}),
    when: change.at,
});

class Store extends DataStore {
    products = this.collection(productSchema).proxy().create();
    history = this.collection(historySchema).proxy().create();
}

const stores: DataStore[] = [];

const open = (options?: Partial<{ entry: typeof entry }>) => {
    const store = new Store(new AuditLogDbPlugin(new MemoryPlugin(`audit-${uuidv4()}`), {
        schema: historySchema,
        entry: options?.entry ?? entry,
    }));

    stores.push(store);

    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('AuditLogDbPlugin', () => {

    it('records an add', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync() as unknown as HistoryRow[];

        expect(rows).toHaveLength(1);
        expect(rows[0].what).toBe('audit_products');
        expect(rows[0].how).toBe('add');
    });

    it('records an update with its delta', async () => {
        const store = open();

        const [product] = await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        product.price = 2;
        await store.saveChangesAsync();

        const rows = await store.history.where(h => h.how === 'update').toArrayAsync() as unknown as HistoryRow[];

        expect(rows).toHaveLength(1);
        // The delta is what makes this a history rather than a list of timestamps.
        expect(JSON.parse(rows[0].changed)).toMatchObject({ price: 2 });
        expect(rows[0].which).toBe(product.id);
    });

    it('records a removal', async () => {
        const store = open();

        const [product] = await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        const rows = await store.history.where(h => h.how === 'remove').toArrayAsync() as unknown as HistoryRow[];

        expect(rows).toHaveLength(1);
        expect(rows[0].which).toBe(product.id);
    });

    it('stamps every change in one save with the same instant', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any, { name: 'b', price: 2 } as any);
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync() as unknown as HistoryRow[];
        const instants = new Set(rows.map(r => r.when.getTime()));

        // One save, one instant — so rows from a save sort together rather than by how long
        // the wrapper's loop took.
        expect(rows).toHaveLength(2);
        expect(instants.size).toBe(1);
    });

    it('does not audit its own writes', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        // One row for the product, and nothing recording the row that recorded it. A wrapper
        // that audited its own appends would not terminate.
        expect(await store.history.countAsync()).toBe(1);
    });

    it('skips a change whose mapping returns nothing', async () => {
        const store = open({ entry: (change => change.operation === 'add' ? null : entry(change)) as typeof entry });

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        // Returning null is how a caller records some operations and not others.
        expect(await store.history.countAsync()).toBe(0);
    });

    it('writes several rows for one change when the mapping returns an array', async () => {
        const store = open({
            entry: (change => [entry(change), { ...entry(change), how: `${change.operation}-copy` }]) as unknown as typeof entry,
        });

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        expect(await store.history.countAsync()).toBe(2);
    });

    it('leaves the caller\'s save result describing only what they submitted', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        const result = await store.saveChangesAsync();

        // The audit rows are appended to the same bulkPersist, so without stripping them the
        // change tracker sees additions it never sent and reports them as unmatched.
        expect(result.aggregate.adds).toBe(1);
    });

    it('leaves the audit table readable as ordinary data', async () => {
        const store = open();

        await store.products.addAsync({ name: 'a', price: 1 } as any);
        await store.saveChangesAsync();

        const filtered = await store.history.where(h => h.what === 'audit_products').toArrayAsync();

        expect(filtered).toHaveLength(1);
    });
});

/**
 * Audited, the backend must still satisfy the contract.
 *
 * The wrapper appends rows to every save and rewrites the result, which is exactly the kind of
 * interference that breaks change tracking in ways its own tests would not notice.
 */
describePluginContract(
    'memory behind AuditLogDbPlugin',
    () => new AuditLogDbPlugin(new MemoryPlugin(`audit-contract-${uuidv4()}`), {
        schema: historySchema,
        entry,
    }),
    { supportsRichTypes: true },
);
