import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const schema = s.define('proxy_deep', {
    id: s.string().key(),
    label: s.string().optional(),
    list: s.object({ k: s.string() }).array(),
    grid: s.array(s.array(s.number())),
    boundary: s.array(s.array(s.array(s.number()))),
    info: s.object({ a: s.number() }).optional(),
}).compile();

class Store extends DataStore {
    things = this.collection(schema).proxy().create();
}

type Row = { id: string; label?: string; list: { k: string }[]; grid: number[][]; boundary: number[][][]; info?: { a: number } };

const seed: Row = { id: 'a', label: 'y', list: [{ k: 'one' }], grid: [[1, 2]], boundary: [[[0, 0], [1, 1]]] };

const edited = async (change: (row: Row, store: Store) => Promise<void> | void) => {
    const name = `proxy-deep-${uuid(8)}`;
    const writer = new Store(new MemoryPlugin(name));
    await writer.things.addAsync(structuredClone(seed) as never);
    await writer.saveChangesAsync();

    const store = new Store(new MemoryPlugin(name));
    const row = await store.things.firstAsync(x => x.id === 'a') as unknown as Row;
    await change(row, store);

    const detected = await store.hasChangesAsync();
    await store.saveChangesAsync();
    const saved = await new Store(new MemoryPlugin(name)).things.firstAsync(x => x.id === 'a') as unknown as Row;

    return { detected, saved };
};

describe('proxy change tracking', () => {
    it('tracks a deleted property', async () => {
        const { detected, saved } = await edited(row => { delete row.label; });

        expect(detected).toBe(true);
        expect(saved.label).toBeUndefined();
    });

    it('tracks a change to an object inside an array', async () => {
        const { detected, saved } = await edited(row => { row.list[0].k = 'two'; });

        expect(detected).toBe(true);
        expect(saved.list).toEqual([{ k: 'two' }]);
    });

    it('tracks a change to an array inside an array', async () => {
        const { detected, saved } = await edited(row => { row.grid[0][1] = 9; });

        expect(detected).toBe(true);
        expect(saved.grid).toEqual([[1, 9]]);
    });

    it('tracks a change three arrays deep', async () => {
        const { detected, saved } = await edited(row => { row.boundary[0][1][0] = 5; });

        expect(detected).toBe(true);
        expect(saved.boundary).toEqual([[[0, 0], [5, 1]]]);
    });

    it('tracks a change to an object assigned after a save', async () => {
        const { detected, saved } = await edited(async (row, store) => {
            row.info = { a: 5 };
            await store.saveChangesAsync();
            row.info.a = 6;
        });

        expect(detected).toBe(true);
        expect(saved.info).toEqual({ a: 6 });
    });

    it('tracks a push onto an array inside an array', async () => {
        const { detected, saved } = await edited(row => { row.grid[0].push(3); });

        expect(detected).toBe(true);
        expect(saved.grid).toEqual([[1, 2, 3]]);
    });
});
