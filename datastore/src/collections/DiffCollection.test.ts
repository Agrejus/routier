import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `.diff()` end to end — snapshot change tracking.
 *
 * The mode's contract: entities are PLAIN objects (no proxy anywhere), the store's memory
 * holds the canonical instances so a reference you hold IS the store's instance, and a save
 * detects mutations by comparing each attachment's content hash against the baseline taken
 * when it was attached. Before this suite the mode was a stub: it enriched without a proxy
 * and nothing ever compared, so a plain mutation was silently lost — the same failure mode
 * defect #17 fixed for `.immutable()` by freezing.
 */

const schema = s.define('diff_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
    tags: s.array(s.string()),
}).compile();

class DiffStore extends DataStore {
    products = this.collection(schema).diff().create();
}

const stores: DataStore[] = [];

const track = <TStore extends DataStore>(store: TStore) => {
    stores.push(store);
    return store;
};

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const diffStore = () => track(new DiffStore(new MemoryPlugin(`diff-${Math.random()}`)));

const seedOne = async (store: DiffStore) => {
    await store.products.addAsync({
        name: 'alpha', price: 10, nested: { inner: { value: 'v' } }, tags: ['a'],
    } as any);
    await store.saveChangesAsync();
};

describe('plain objects, live references', () => {
    it('hands back entities with no tracking proxy', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();

        expect(row.__isProxy__).toBeUndefined();
        expect(row.__tracking__).toBeUndefined();
    });

    it('two reads of the same row resolve to the same instance', async () => {
        const store = diffStore();
        await seedOne(store);

        const [first] = await store.products.toArrayAsync();
        const [second] = await store.products.toArrayAsync();

        // The store's memory is the session: the canonical instance IS what callers hold.
        expect(second).toBe(first);
    });
});

describe('save-time change detection', () => {
    it('persists a plain scalar mutation', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.price = 99;

        const result = await store.saveChangesAsync();
        expect(result.aggregate.updates).toBe(1);

        const [after]: any[] = await store.products.toArrayAsync();
        expect(after.price).toBe(99);
    });

    it('persists a nested mutation two levels deep', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.nested.inner.value = 'changed';

        const result = await store.saveChangesAsync();
        expect(result.aggregate.updates).toBe(1);

        const [after]: any[] = await store.products.toArrayAsync();
        expect(after.nested.inner.value).toBe('changed');
    });

    it('persists an in-place array mutation', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.tags.push('b');

        const result = await store.saveChangesAsync();
        expect(result.aggregate.updates).toBe(1);

        const [after]: any[] = await store.products.toArrayAsync();
        expect(after.tags).toEqual(['a', 'b']);
    });

    it('reports nothing when nothing changed', async () => {
        const store = diffStore();
        await seedOne(store);

        await store.products.toArrayAsync();

        expect(store.products.hasChanges()).toBe(false);
        const result = await store.saveChangesAsync();
        expect(result.aggregate.size).toBe(0);
    });

    it('does not report a write of the same value as a change', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.price = row.price;

        expect(store.products.hasChanges()).toBe(false);
    });

    it('goes clean after a save and stays clean', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.price = 99;
        await store.saveChangesAsync();

        // The persisted state is the new baseline — without re-baselining, this entity
        // would be re-sent as an update on every later save (the shape of defect #11).
        expect(store.products.hasChanges()).toBe(false);
        const again = await store.saveChangesAsync();
        expect(again.aggregate.size).toBe(0);
    });

    it('tracks a mutation made after a previous save of the same entity', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.price = 99;
        await store.saveChangesAsync();

        row.price = 100;
        const result = await store.saveChangesAsync();

        expect(result.aggregate.updates).toBe(1);
        const [after]: any[] = await store.products.toArrayAsync();
        expect(after.price).toBe(100);
    });

    it('an entity added and saved is tracked through its returned reference', async () => {
        const store = diffStore();

        const [added]: any[] = await store.products.addAsync({
            name: 'beta', price: 1, nested: { inner: { value: 'x' } }, tags: [],
        } as any);
        await store.saveChangesAsync();

        added.price = 2;
        const result = await store.saveChangesAsync();

        expect(result.aggregate.updates).toBe(1);
        const [after]: any[] = await store.products.toArrayAsync();
        expect(after.price).toBe(2);
    });
});

describe('detach and re-read semantics', () => {
    it('a detached entity is no longer tracked', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        store.products.attachments.remove(row);

        row.price = 99;

        expect(store.products.hasChanges()).toBe(false);
        const result = await store.saveChangesAsync();
        expect(result.aggregate.size).toBe(0);
    });

    it('unsaved local edits survive a re-read', async () => {
        const store = diffStore();
        await seedOne(store);

        const [row]: any[] = await store.products.toArrayAsync();
        row.price = 99;

        // The re-read must not absorb the caller's pending edit into a fresh baseline —
        // local state wins until saved.
        const [again]: any[] = await store.products.toArrayAsync();

        expect(again).toBe(row);
        expect(again.price).toBe(99);
        expect(store.products.hasChanges()).toBe(true);
    });
});
