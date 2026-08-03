import { afterEach, describe, expect, it } from "@jest/globals";
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * The immutable `update()` path — see specs/immutable-updates.md.
 *
 * These are the spike's acceptance tests, and the first two blocks are the reason it
 * exists. Defects #12 and #13 in specs/known-defects.md are OPEN against the proxy path
 * and pinned there with `it.failing`; the same scenarios pass here with no other change.
 * That is the evidence that they are proxy-lifecycle bugs rather than bugs in the save
 * pipeline: an array is a value a patch replaces, so there is no array proxy to lose, and
 * a patch is a partial entity, so the entity's own serializer handles it at any depth.
 *
 * The third block is the design's own risk. Returning new values instead of mutating in
 * place means a caller's reference goes stale, so the collection resolves references by
 * id and applies patches to the current value. Every test there is a way that could
 * silently lose a write.
 */

const arrays = s.define('spike_arrays', {
    id: s.string().key(),
    strings: s.array(s.string()),
    dates: s.array(s.date()),
}).compile();

const deep3 = s.define('spike_deep3', {
    id: s.string().key(),
    nested: s.object({ inner: s.object({ deepest: s.object({ value: s.string() }) }) }),
}).compile();

class ArrayStore extends DataStore { items = this.collection(arrays).create(); }
class DeepStore extends DataStore { items = this.collection(deep3).create(); }

/**
 * Every store opened by a test, so `afterEach` can dispose it.
 *
 * Not optional bookkeeping: constructing a DataStore opens a BroadcastChannel pair per
 * collection — two MessagePort handles that hold the Node event loop open whether or not
 * anything ever subscribes. Leaving them is what makes a run need `--forceExit`.
 */
const stores: DataStore[] = [];

const open = <TStore extends DataStore>(Store: new (plugin: MemoryPlugin) => TStore) => {
    const store = new Store(new MemoryPlugin(`spike-${Math.random()}`));
    stores.push(store);
    return store;
};

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

describe('DEFECT #12 — array updates through update()', () => {
    it('detects and persists an array element change after the first save', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync({ id: 'a', strings: ['p', 'q'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();

        store.items.update(e, prev => ({ ...prev, strings: ['changed', 'q'] } as any));

        expect((await store.saveChangesAsync()).aggregate.updates).toBe(1);
        expect(((await store.items.toArrayAsync())[0] as any).strings[0]).toBe('changed');
    });

    it('persists an appended element', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();

        store.items.update(e, prev => ({ ...prev, strings: [...prev.strings, 'added'] } as any));
        await store.saveChangesAsync();

        expect(((await store.items.toArrayAsync())[0] as any).strings).toEqual(['p', 'added']);
    });

    it('persists a date array element', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();

        store.items.update(e, { dates: [new Date(86_400_000)] });
        await store.saveChangesAsync();

        const reread: any = (await store.items.toArrayAsync())[0];
        expect(reread.dates[0].getTime()).toBe(86_400_000);
    });
});

describe('DEFECT #13 — depth-3 updates through update()', () => {
    it('saves a depth-3 change without throwing', async () => {
        const store = open(DeepStore);
        await store.items.addAsync({ id: 'a', nested: { inner: { deepest: { value: 'x' } } } } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();

        store.items.update(e, { nested: { inner: { deepest: { value: 'y' } } } });

        expect((await store.saveChangesAsync()).aggregate.updates).toBe(1);
        expect(((await store.items.toArrayAsync())[0] as any).nested.inner.deepest.value).toBe('y');
    });

    it('leaves untouched siblings alone', async () => {
        const wide = s.define('spike_wide', {
            id: s.string().key(),
            keep: s.string(),
            nested: s.object({ inner: s.object({ a: s.string(), b: s.string() }) }),
        }).compile();
        class WideStore extends DataStore { items = this.collection(wide).create(); }

        const store = open(WideStore);
        await store.items.addAsync({ id: 'a', keep: 'untouched', nested: { inner: { a: '1', b: '2' } } } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();
        store.items.update(e, { nested: { inner: { a: '9' } } });
        await store.saveChangesAsync();

        const reread: any = (await store.items.toArrayAsync())[0];
        expect(reread.keep).toBe('untouched');
        expect(reread.nested.inner.a).toBe('9');
        expect(reread.nested.inner.b).toBe('2');
    });
});

describe('stale references', () => {
    it('applies a patch through a stale reference to the CURRENT value', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [v1]: any[] = await store.items.toArrayAsync();

        store.items.update(v1, { strings: ['second'] });
        // v1 is now two generations behind; the patch must still land on current.
        store.items.update(v1, { dates: [new Date(1000)] });

        await store.saveChangesAsync();

        const reread: any = (await store.items.toArrayAsync())[0];
        expect(reread.strings).toEqual(['second']);
        expect(reread.dates[0].getTime()).toBe(1000);
    });

    it('gives an updater function the current value, not the caller reference', async () => {
        const counter = s.define('spike_counter', { id: s.string().key(), n: s.number() }).compile();
        class CounterStore extends DataStore { items = this.collection(counter).create(); }

        const store = open(CounterStore);
        await store.items.addAsync({ id: 'a', n: 0 } as any);
        await store.saveChangesAsync();

        const [v1]: any[] = await store.items.toArrayAsync();

        store.items.update(v1, prev => ({ ...prev, n: prev.n + 1 } as any));
        store.items.update(v1, prev => ({ ...prev, n: prev.n + 1 } as any));
        store.items.update(v1, prev => ({ ...prev, n: prev.n + 1 } as any));

        await store.saveChangesAsync();

        expect(((await store.items.toArrayAsync())[0] as any).n).toBe(3);
    });

    it('reports zero pending after a save and does not replay', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();
        store.items.update(e, { strings: ['once'] });
        await store.saveChangesAsync();

        expect((await store.previewChangesAsync()).aggregate.size).toBe(0);
        expect((await store.saveChangesAsync()).aggregate.size).toBe(0);
    });

    it('refuses to update a row that is not attached', async () => {
        const store = open(ArrayStore);

        expect(() => store.items.update({ id: 'ghost' } as any, { strings: ['x'] }))
            .toThrow(/not attached/);
    });

    it('drops a pending patch when the row is removed, and does not resurrect it', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync(
            { id: 'a', strings: ['p'], dates: [new Date(0)] } as any,
            { id: 'b', strings: ['q'], dates: [new Date(0)] } as any,
        );
        await store.saveChangesAsync();

        const rows: any[] = await store.items.toArrayAsync();
        const doomed = rows.find(r => r.id === 'a');

        store.items.update(doomed, { strings: ['about-to-vanish'] });
        await store.items.removeAsync(doomed);
        await store.saveChangesAsync();

        expect(await store.items.countAsync()).toBe(1);

        // An unrelated later save must not bring it back.
        store.items.update(rows.find(r => r.id === 'b'), { strings: ['unrelated'] });
        await store.saveChangesAsync();

        expect(await store.items.countAsync()).toBe(1);
    });

    it('resolves a reference taken BEFORE the first save, once the row is saved', async () => {
        const store = open(ArrayStore);

        const [added]: any[] = await store.items.addAsync(
            { id: 'a', strings: ['p'], dates: [new Date(0)] } as any
        );
        await store.saveChangesAsync();

        // `added` is pre-save. The row it names exists now, so patching it is an update.
        store.items.update(added, { strings: ['after-save'] });
        await store.saveChangesAsync();

        expect(((await store.items.toArrayAsync())[0] as any).strings).toEqual(['after-save']);
    });

    it('current() resolves a stale reference and isCurrent() reports honestly', async () => {
        const store = open(ArrayStore);
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [v1]: any[] = await store.items.toArrayAsync();
        const v2 = store.items.update(v1, { strings: ['next'] }) as any;

        expect(store.items.isCurrent(v1)).toBe(false);
        expect(store.items.isCurrent(v2)).toBe(true);
        expect((store.items.current(v1) as any).strings).toEqual(['next']);
    });
});

/**
 * Updating a row that has been added but not yet saved.
 *
 * The spike could not do this: `update()` resolved a row by reading its id, and an
 * identity-keyed row has no id until the database assigns one. It threw, which was honest
 * but made the immutable path unusable for the ordinary "add a row, then adjust it before
 * saving" flow — and that gap is the reason the path could not become the default.
 *
 * The fix keys unsaved rows by object reference instead. What these tests hold to is that
 * keying that way does not cost the guarantees the id path provides: one INSERT rather than
 * an insert-then-update, every generation of the reference resolving to the same row, and
 * nothing resurrected after the changes are dropped.
 */
describe('unsaved rows', () => {
    const identity = s.define('spike_identity', {
        id: s.string().key().identity(),
        name: s.string(),
        n: s.number(),
    }).compile();

    class IdentityStore extends DataStore { items = this.collection(identity).create(); }

    it('patches an unsaved row with an identity key', async () => {
        const store = open(IdentityStore);

        const [added]: any[] = await store.items.addAsync({ name: 'first', n: 1 } as any);

        const patched: any = store.items.update(added, { name: 'second' });

        expect(patched.name).toBe('second');
        // Unchanged properties survive, and the caller's copy is not touched.
        expect(patched.n).toBe(1);
        expect(added.name).toBe('first');

        await store.saveChangesAsync();

        const [row]: any[] = await store.items.toArrayAsync();
        expect(row.name).toBe('second');
    });

    it('sends ONE insert, not an insert followed by an update', async () => {
        const store = open(IdentityStore);

        const [added]: any[] = await store.items.addAsync({ name: 'first', n: 1 } as any);
        store.items.update(added, { name: 'second' });

        const result = await store.saveChangesAsync();

        expect(result.aggregate.adds).toBe(1);
        expect(result.aggregate.updates).toBe(0);
        expect(await store.items.countAsync()).toBe(1);
    });

    it('accumulates successive patches through the original reference', async () => {
        const store = open(IdentityStore);

        const [v1]: any[] = await store.items.addAsync({ name: 'first', n: 1 } as any);

        store.items.update(v1, { name: 'second' });
        store.items.update(v1, prev => ({ ...prev, n: prev.n + 10 } as any));

        await store.saveChangesAsync();

        const [row]: any[] = await store.items.toArrayAsync();
        expect(row.name).toBe('second');
        expect(row.n).toBe(11);
        expect(await store.items.countAsync()).toBe(1);
    });

    /**
     * PINNED — defect #23. Passes while the defect exists; fails when it is fixed.
     *
     * Written against a plain add rather than through `update()`, because `update()` is not
     * what breaks it: `UnknownKeyAdditions` keys pending adds by content hash, so two rows
     * equal in content collapse whether a patch made them equal or they started that way.
     * Pinning the narrower route would have credited the bug to the wrong code.
     */
    it.failing('collapses two identical unsaved rows with identity keys [pinned: known defect #23]', async () => {
        const store = open(IdentityStore);

        await store.items.addAsync({ name: 'b', n: 2 } as any);
        await store.items.addAsync({ name: 'b', n: 2 } as any);
        await store.saveChangesAsync();

        expect(await store.items.countAsync()).toBe(2);
    });

    it('keeps two unsaved rows distinct when they differ in any property', async () => {
        // The re-key path: patching one pending row must move its hash without disturbing
        // the other's. Anything short of delete-then-set leaves the row under both keys.
        const store = open(IdentityStore);

        const [a]: any[] = await store.items.addAsync({ name: 'a', n: 1 } as any);
        await store.items.addAsync({ name: 'b', n: 2 } as any);

        store.items.update(a, { name: 'patched' });

        await store.saveChangesAsync();

        const names = (await store.items.toArrayAsync() as any[]).map(r => r.name).sort();
        expect(names).toEqual(['b', 'patched']);
    });

    it('patches an unsaved row with a caller-supplied key', async () => {
        const store = open(ArrayStore);

        const [added]: any[] = await store.items.addAsync(
            { id: 'a', strings: ['p'], dates: [new Date(0)] } as any
        );

        store.items.update(added, { strings: ['patched'] });
        await store.saveChangesAsync();

        const rows: any[] = await store.items.toArrayAsync();
        expect(rows).toHaveLength(1);
        expect(rows[0].strings).toEqual(['patched']);
    });

    it('current() reports the pending value of an unsaved row', async () => {
        const store = open(IdentityStore);

        const [v1]: any[] = await store.items.addAsync({ name: 'first', n: 1 } as any);
        const v2 = store.items.update(v1, { name: 'second' }) as any;

        expect((store.items.current(v1) as any).name).toBe('second');
        expect(store.items.isCurrent(v1)).toBe(false);
        expect(store.items.isCurrent(v2)).toBe(true);
    });

    // The matching case for a pending add that is DROPPED rather than saved lives in
    // ChangeTracker.test.ts — a store has no public way to discard changes, so the only
    // honest way to reach it is through the tracker.
});
