import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `.immutable()` end to end.
 *
 * Before this, the mode was two-thirds wired and nobody could tell: `ImmutableCollection`
 * extended `RemovableCollection` so it had no `addAsync` at all, and `RequestContext`
 * hardcoded `"proxy"` so even a working immutable collection installed tracking proxies on
 * every read. Both are fixed; these tests exist so neither can quietly come back.
 *
 * The parity block matters most. An immutable collection is not a reduced collection — it is
 * the same collection with a different way of expressing a change, so anything the default
 * can do it must do too.
 */

const schema = s.define('immutable_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
    tags: s.array(s.string()),
}).compile();

class ImmutableStore extends DataStore {
    products = this.collection(schema).immutable().create();
}

class ProxyStore extends DataStore {
    products = this.collection(schema).create();
}

/**
 * Opened stores, so `afterEach` can dispose them. A DataStore opens a BroadcastChannel pair
 * per collection at construction — two MessagePort handles that hold the event loop open
 * whether or not anything subscribes — and leaving them is what makes a run need
 * `--forceExit`.
 */
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

const immutableStore = () => track(new ImmutableStore(new MemoryPlugin(`imm-${Math.random()}`)));
const proxyStore = () => track(new ProxyStore(new MemoryPlugin(`prx-${Math.random()}`)));

const seedOne = async (store: ImmutableStore | ProxyStore) => {
    await store.products.addAsync({
        name: 'alpha', price: 10, nested: { inner: { value: 'v' } }, tags: ['a'],
    } as any);
    await store.saveChangesAsync();
    return (await store.products.toArrayAsync())[0] as any;
};

describe('ImmutableCollection parity with the default collection', () => {
    it('can add', async () => {
        const store = immutableStore();

        await store.products.addAsync({ name: 'alpha', price: 1, nested: { inner: { value: 'v' } }, tags: [] } as any);
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(1);
    });

    it('can query', async () => {
        const store = immutableStore();
        await seedOne(store);

        expect((await store.products.firstAsync() as any).name).toBe('alpha');
    });

    it('can remove', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        await store.products.removeAsync(row);
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(0);
    });

    it('can removeAll', async () => {
        const store = immutableStore();
        await seedOne(store);

        await store.products.removeAllAsync();
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(0);
    });

    it('assigns identities on add, like the default', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        expect(typeof row._id).toBe('string');
        expect(row._id.length).toBeGreaterThan(0);
    });
});

describe('ImmutableCollection reads', () => {
    it('hands back plain objects, not tracking proxies', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        // The proxy exposes a marker; an immutable read must not.
        expect((row as any).__isProxy__).toBeUndefined();
    });

    it('carries no change-tracking STATE, only a residual paused flag', async () => {
        const store = immutableStore();
        const row = await seedOne(store);
        const tracking = (row as any).__tracking__;

        // The parts that decide what a save persists are all absent, which is what matters:
        // there is no `changes` map, no `original` map, and no dirty flag to leave stale.
        expect(tracking?.changes).toBeUndefined();
        expect(tracking?.original).toBeUndefined();
        expect(tracking?.isDirty).toBeUndefined();
    });

    // Guards the fix for defect #16 — the pause bootstrap's `__tracking__` used to survive
    // on non-proxy reads as a stray `{ isPaused: false }`.
    it('installs no __tracking__ bookkeeping at all', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        expect((row as any).__tracking__).toBeUndefined();
    });

    // Guards the fix for defect #17. Freezing is what makes a plain mutation loud instead of
    // silently lost, so this is the assertion that makes the mode safe to recommend.
    it('freezes what it returns', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        expect(Object.isFrozen(row)).toBe(true);
    });

    it('by contrast, the default collection DOES proxy its reads', async () => {
        // Pins the difference rather than asserting it in prose — if the default ever stops
        // proxying, this fails and the comparison above needs rewriting.
        const store = proxyStore();
        const row = await seedOne(store);

        expect((row as any).__isProxy__).toBe(true);
    });
});

describe('ImmutableCollection writes go through update()', () => {
    it('persists a scalar patch', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        store.products.update(row, { price: 99 });
        await store.saveChangesAsync();

        expect((await store.products.firstAsync() as any).price).toBe(99);
    });

    it('persists a patch two levels deep, which the proxy path cannot', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        store.products.update(row, { nested: { inner: { value: 'after' } } });
        await store.saveChangesAsync();

        expect((await store.products.firstAsync() as any).nested.inner.value).toBe('after');
    });

    it('persists an array replacement, which the proxy path loses after a merge', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        store.products.update(row, { tags: ['x', 'y'] });
        await store.saveChangesAsync();

        expect((await store.products.firstAsync() as any).tags).toEqual(['x', 'y']);
    });

    it('reports one update per changed row', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        store.products.update(row, { price: 5 });

        expect((await store.saveChangesAsync()).aggregate.updates).toBe(1);
    });

    it('reports nothing pending after a save', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        store.products.update(row, { price: 5 });
        await store.saveChangesAsync();

        expect(await store.hasChangesAsync()).toBe(false);
        expect((await store.saveChangesAsync()).aggregate.size).toBe(0);
    });

    it('resolves a stale reference to the current value', async () => {
        const store = immutableStore();
        const v1 = await seedOne(store);

        store.products.update(v1, { price: 2 });
        store.products.update(v1, { name: 'renamed' });
        await store.saveChangesAsync();

        const reread: any = await store.products.firstAsync();

        expect(reread.price).toBe(2);
        expect(reread.name).toBe('renamed');
    });

    it('gives an updater function the current value', async () => {
        const store = immutableStore();
        const v1 = await seedOne(store);

        store.products.update(v1, (prev: any) => ({ ...prev, price: prev.price + 1 }));
        store.products.update(v1, (prev: any) => ({ ...prev, price: prev.price + 1 }));
        await store.saveChangesAsync();

        expect((await store.products.firstAsync() as any).price).toBe(12);
    });

    it('does not treat a plain mutation as a change', async () => {
        const store = immutableStore();
        const row = await seedOne(store);

        // Rejected, not silently dropped. Before freezing was wired this write vanished:
        // untracked because there is no proxy, unrejected because nothing was frozen. A lost
        // write that nobody is told about is the worst of the available behaviours.
        expect(() => { (row as any).price = 12345; }).toThrow(TypeError);

        expect(await store.hasChangesAsync()).toBe(false);
        expect((await store.saveChangesAsync()).aggregate.size).toBe(0);
        expect((await store.products.firstAsync() as any).price).toBe(10);
    });
});
