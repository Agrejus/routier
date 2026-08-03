import { describe, expect, it } from "@jest/globals";
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

const plugin = () => new MemoryPlugin(`spike-${Math.random()}`);

describe('DEFECT #12 — array updates through update()', () => {
    it('detects and persists an array element change after the first save', async () => {
        const store = new ArrayStore(plugin());
        await store.items.addAsync({ id: 'a', strings: ['p', 'q'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();

        store.items.update(e, prev => ({ ...prev, strings: ['changed', 'q'] } as any));

        expect((await store.saveChangesAsync()).aggregate.updates).toBe(1);
        expect(((await store.items.toArrayAsync())[0] as any).strings[0]).toBe('changed');
    });

    it('persists an appended element', async () => {
        const store = new ArrayStore(plugin());
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();

        store.items.update(e, prev => ({ ...prev, strings: [...prev.strings, 'added'] } as any));
        await store.saveChangesAsync();

        expect(((await store.items.toArrayAsync())[0] as any).strings).toEqual(['p', 'added']);
    });

    it('persists a date array element', async () => {
        const store = new ArrayStore(plugin());
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
        const store = new DeepStore(plugin());
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

        const store = new WideStore(plugin());
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
        const store = new ArrayStore(plugin());
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

        const store = new CounterStore(plugin());
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
        const store = new ArrayStore(plugin());
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [e]: any[] = await store.items.toArrayAsync();
        store.items.update(e, { strings: ['once'] });
        await store.saveChangesAsync();

        expect((await store.previewChangesAsync()).aggregate.size).toBe(0);
        expect((await store.saveChangesAsync()).aggregate.size).toBe(0);
    });

    it('refuses to update a row that is not attached', async () => {
        const store = new ArrayStore(plugin());

        expect(() => store.items.update({ id: 'ghost' } as any, { strings: ['x'] }))
            .toThrow(/not attached/);
    });

    it('drops a pending patch when the row is removed, and does not resurrect it', async () => {
        const store = new ArrayStore(plugin());
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

    it('current() resolves a stale reference and isCurrent() reports honestly', async () => {
        const store = new ArrayStore(plugin());
        await store.items.addAsync({ id: 'a', strings: ['p'], dates: [new Date(0)] } as any);
        await store.saveChangesAsync();

        const [v1]: any[] = await store.items.toArrayAsync();
        const v2 = store.items.update(v1, { strings: ['next'] }) as any;

        expect(store.items.isCurrent(v1)).toBe(false);
        expect(store.items.isCurrent(v2)).toBe(true);
        expect((store.items.current(v1) as any).strings).toEqual(['next']);
    });
});
