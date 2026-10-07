import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const schema = s.define('reread_things', {
    id: s.string().key(),
    note: s.string().nullable(),
    label: s.string().optional(),
    info: s.object({ a: s.number() }).optional(),
    box: s.object({ inner: s.string().nullable() }).nullable(),
    list: s.array(s.string()),
}).compile();

const stores = (mode: 'proxy' | 'diff', name: string) => {
    class ProxyStore extends DataStore {
        things = this.collection(schema).proxy().create();
    }

    class DiffStore extends DataStore {
        things = this.collection(schema).diff().create();
    }

    const make = () => (mode === 'proxy' ? new ProxyStore(new MemoryPlugin(name)) : new DiffStore(new MemoryPlugin(name)));

    return { reader: make(), writer: make() };
};

describe.each(['proxy', 'diff'] as const)('re-reading in %s mode', mode => {
    const seed = { id: 'a', note: 'x', label: 'y', info: { a: 1 }, box: { inner: 'z' }, list: ['one'] };

    const reread = async (change: (row: Record<string, unknown>) => void) => {
        const { reader, writer } = stores(mode, `reread-${uuid(8)}`);
        await writer.things.addAsync(seed as never);
        await writer.saveChangesAsync();

        await reader.things.firstAsync(x => x.id === 'a');

        const row = await writer.things.firstAsync(x => x.id === 'a') as unknown as Record<string, unknown>;
        change(row);
        await writer.saveChangesAsync();

        return reader.things.firstAsync(x => x.id === 'a') as unknown as Promise<Record<string, unknown>>;
    };

    it('clears a nullable value set to null', async () => {
        expect((await reread(row => { row.note = null; })).note).toBeNull();
    });

    it('clears an optional value that was removed', async () => {
        expect(await reread(row => { row.label = undefined; })).not.toHaveProperty('label', 'y');
    });

    it('clears an optional object that was removed', async () => {
        expect((await reread(row => { row.info = undefined; })).info).toBeUndefined();
    });

    it('clears a nullable object set to null', async () => {
        expect((await reread(row => { row.box = null; })).box).toBeNull();
    });

    it('clears a nested nullable leaf set to null', async () => {
        expect((await reread(row => { (row.box as { inner: string | null }).inner = null; })).box).toEqual({ inner: null });
    });

    it('takes an emptied list', async () => {
        expect((await reread(row => { row.list = []; })).list).toEqual([]);
    });

    it('still takes a changed value', async () => {
        expect((await reread(row => { row.note = 'changed'; })).note).toBe('changed');
    });

    it('leaves the entity unmodified after a clean re-read', async () => {
        const { reader, writer } = stores(mode, `reread-${uuid(8)}`);
        await writer.things.addAsync(seed as never);
        await writer.saveChangesAsync();
        await reader.things.firstAsync(x => x.id === 'a');

        const row = await writer.things.firstAsync(x => x.id === 'a') as unknown as Record<string, unknown>;
        row.note = null;
        row.label = undefined;
        await writer.saveChangesAsync();
        await reader.things.firstAsync(x => x.id === 'a');

        expect(await reader.hasChangesAsync()).toBe(false);
    });
});

describe('re-reading over an unsaved local edit', () => {
    it('keeps the local edit in diff mode', async () => {
        const { reader, writer } = stores('diff', `reread-${uuid(8)}`);
        await writer.things.addAsync({ id: 'a', note: 'x', box: null, list: [] } as never);
        await writer.saveChangesAsync();

        const local = await reader.things.firstAsync(x => x.id === 'a');
        local.note = 'mine';

        const row = await writer.things.firstAsync(x => x.id === 'a');
        row.note = null;
        await writer.saveChangesAsync();

        expect((await reader.things.firstAsync(x => x.id === 'a')).note).toBe('mine');
    });

    it('applies a stored null in proxy mode, as it applies a stored value', async () => {
        const { reader, writer } = stores('proxy', `reread-${uuid(8)}`);
        await writer.things.addAsync({ id: 'a', note: 'x', box: null, list: [] } as never);
        await writer.saveChangesAsync();

        const local = await reader.things.firstAsync(x => x.id === 'a');
        local.note = 'mine';

        const row = await writer.things.firstAsync(x => x.id === 'a');
        row.note = null;
        await writer.saveChangesAsync();

        expect((await reader.things.firstAsync(x => x.id === 'a')).note).toBeNull();
    });

    it('still reports an unsaved edit to another value after a re-read in proxy mode', async () => {
        const { reader, writer } = stores('proxy', `reread-${uuid(8)}`);
        await writer.things.addAsync({ id: 'a', note: 'x', label: 'y', box: null, list: [] } as never);
        await writer.saveChangesAsync();

        const local = await reader.things.firstAsync(x => x.id === 'a');
        local.label = 'mine';

        const row = await writer.things.firstAsync(x => x.id === 'a');
        row.note = null;
        await writer.saveChangesAsync();
        await reader.things.firstAsync(x => x.id === 'a');

        expect(await reader.hasChangesAsync()).toBe(true);
    });

    it('stays clean after a re-read once an earlier edit was saved', async () => {
        const { reader, writer } = stores('proxy', `reread-${uuid(8)}`);
        await writer.things.addAsync({ id: 'a', note: 'x', label: 'y', box: null, list: [] } as never);
        await writer.saveChangesAsync();

        const local = await reader.things.firstAsync(x => x.id === 'a');
        local.label = 'saved';
        await reader.saveChangesAsync();

        const row = await writer.things.firstAsync(x => x.id === 'a');
        row.note = null;
        await writer.saveChangesAsync();
        await reader.things.firstAsync(x => x.id === 'a');

        expect(await reader.hasChangesAsync()).toBe(false);
    });
});

describe.each(['proxy', 'diff'] as const)('re-reading an unchanged row in %s mode', mode => {
    it('keeps the key of an optional value the row never held', async () => {
        const { writer } = stores(mode, `reread-keys-${uuid(8)}`);
        const [added] = await writer.things.addAsync({ id: 'a', note: null, list: [] } as never);
        await writer.saveChangesAsync();
        const keysBefore = Object.keys(added).sort();

        const [reread] = await writer.things.toArrayAsync();

        expect(Object.keys(reread).sort()).toEqual(keysBefore);
    });
});
