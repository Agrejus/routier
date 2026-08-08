import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * Soft delete, declared on the collection.
 *
 * The half that is easy to get wrong is the scope. Stamping a row without hiding it leaves
 * deleted rows in every result, which looks like the feature is not working; hiding without
 * stamping deletes the row for real. So most of these check that a removed row is BOTH absent
 * from the collection and still present in the table underneath.
 *
 * A second STORE over the same database, whose collection omits `.softDelete()`, is what makes
 * that observable — and is also the documented way to read deleted rows.
 */

const productSchema = s.define('soft_products', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    deletedAt: s.date().nullable(),
}).compile();

const flaggedSchema = s.define('flagged_products', {
    id: s.string().key().identity(),
    name: s.string(),
    isDeleted: s.boolean().nullable(),
}).compile();

class Store extends DataStore {
    products = this.collection(productSchema).softDelete(x => x.deletedAt).proxy().create();
    flagged = this.collection(flaggedSchema).softDelete(x => x.isDeleted).proxy().create();
}

class DiffStore extends DataStore {
    products = this.collection(productSchema).softDelete(x => x.deletedAt).diff().create();
}

class ImmutableStore extends DataStore {
    products = this.collection(productSchema).softDelete(x => x.deletedAt).immutable().create();
}

/**
 * The same table with no scope, which is how a caller reads what was deleted.
 *
 * It has to be a separate STORE, not a second collection: a store rejects two collections over
 * one schema. That is also the honest way to expose deleted rows — reading them is a different
 * enough operation to deserve its own declaration.
 */
class UnscopedStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

const stores: DataStore[] = [];

/** Both stores point at the same in-memory database, which `dbs` keys by name. */
const open = <T extends DataStore>(Ctor: new (plugin: MemoryPlugin) => T) => {
    const databaseName = `soft-${uuidv4()}`;
    const store = new Ctor(new MemoryPlugin(databaseName));
    const unscoped = new UnscopedStore(new MemoryPlugin(databaseName));

    stores.push(store, unscoped);

    return { store, unscoped };
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('softDelete', () => {

    it('hides a removed row from the collection', async () => {
        const { store, unscoped } = open(Store);

        const [product] = await store.products.addAsync({ name: 'a', price: 1, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(0);
    });

    it('keeps the row in the table', async () => {
        const { store, unscoped } = open(Store);

        const [product] = await store.products.addAsync({ name: 'a', price: 1, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        // The whole point: hidden, not gone.
        const all = await unscoped.products.toArrayAsync();

        expect(all).toHaveLength(1);
        expect(all[0].deletedAt).toBeInstanceOf(Date);
    });

    it('leaves rows that were not removed visible', async () => {
        const { store, unscoped } = open(Store);

        const [a, b] = await store.products.addAsync(
            { name: 'a', price: 1, deletedAt: null } as any,
            { name: 'b', price: 2, deletedAt: null } as any,
        );
        await store.saveChangesAsync();

        await store.products.removeAsync(a);
        await store.saveChangesAsync();

        const remaining = await store.products.toArrayAsync();

        expect(remaining.map(p => p.name)).toEqual(['b']);
        expect(b.deletedAt).toBeNull();
    });

    it('hides removed rows from a filtered query too', async () => {
        const { store, unscoped } = open(Store);

        const [product] = await store.products.addAsync({ name: 'a', price: 1, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        // The scope has to survive being combined with the caller's own filter — a scope that
        // only applied to unfiltered reads would be worse than none.
        expect(await store.products.where(p => p.name === 'a').toArrayAsync()).toEqual([]);
        expect(await store.products.countAsync()).toBe(0);
    });

    it('does not resurrect a removed row on a later read', async () => {
        const { store, unscoped } = open(Store);

        const [product] = await store.products.addAsync({ name: 'a', price: 1, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(0);
        expect(await unscoped.products.countAsync()).toBe(1);
    });

    it('works on a diff-tracked collection', async () => {
        const { store, unscoped } = open(DiffStore);

        const [product] = await store.products.addAsync({ name: 'a', price: 1, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(0);
        expect(await unscoped.products.countAsync()).toBe(1);
    });

    it('works on an immutable collection, where assignment would throw', async () => {
        const { store, unscoped } = open(ImmutableStore);

        const [product] = await store.products.addAsync({ name: 'a', price: 1, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        // An immutable read is frozen, so the stamp cannot be a plain assignment — it routes
        // through the same patch mechanism `update()` uses.
        expect(await store.products.countAsync()).toBe(0);
        expect(await unscoped.products.countAsync()).toBe(1);
    });

    it('accepts a boolean property as well as a date', async () => {
        const { store, unscoped } = open(Store);

        const [product] = await store.flagged.addAsync({ name: 'a', isDeleted: null } as any);
        await store.saveChangesAsync();

        await store.flagged.removeAsync(product);
        await store.saveChangesAsync();

        expect(await store.flagged.countAsync()).toBe(0);
    });

    it('treats a row with the property absent as not deleted', async () => {
        const { store, unscoped } = open(Store);

        // Loose equality is what makes this work. Enabling soft delete on an existing table
        // whose rows predate the column would otherwise hide every one of them.
        await unscoped.products.addAsync({ name: 'legacy', price: 1 } as any);
        await unscoped.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(1);
    });
});

describe('softDelete declaration', () => {

    it('rejects a property the schema does not declare', () => {
        expect(() => {
            class Bad extends DataStore {
                products = this.collection(productSchema).softDelete(x => (x as any).nope).proxy().create();
            }
            new Bad(new MemoryPlugin('bad'));
        }).toThrow(/does not declare/i);
    });

    it('rejects a property that cannot hold "never deleted"', () => {
        const notNullable = s.define('bad_products', {
            id: s.string().key().identity(),
            deletedAt: s.date(),
        }).compile();

        expect(() => {
            class Bad extends DataStore {
                products = this.collection(notNullable).softDelete(x => x.deletedAt).proxy().create();
            }
            new Bad(new MemoryPlugin('bad'));
        }).toThrow(/nullable or optional/i);
    });

    it('rejects a property of the wrong type', () => {
        const wrongType = s.define('bad_type_products', {
            id: s.string().key().identity(),
            deletedAt: s.string().nullable(),
        }).compile();

        expect(() => {
            class Bad extends DataStore {
                products = this.collection(wrongType).softDelete(x => x.deletedAt).proxy().create();
            }
            new Bad(new MemoryPlugin('bad'));
        }).toThrow(/date or boolean/i);
    });
});
