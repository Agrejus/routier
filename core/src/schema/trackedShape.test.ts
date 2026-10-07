import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

type Tracking = { changes: Record<string, unknown> };
type Row = Record<string, any> & { __tracking__?: Tracking };

const schema = s.define('tracked_shape', {
    id: s.string().key(),
    info: s.object({ a: s.number(), deep: s.object({ b: s.number() }) }).optional(),
    list: s.object({ k: s.string(), inner: s.object({ n: s.number() }) }).array(),
    grid: s.array(s.array(s.number())),
    tags: s.array(s.string()),
    files: s.array(s.file()),
    file: s.file().optional(),
}).compile();

const read = (row: object): Row => schema.enrich(row as never, 'proxy') as Row;

const stored = () => ({ id: 'a', list: [{ k: 'one', inner: { n: 1 } }], grid: [[1, 2]], tags: ['x'], files: [{ key: 'f' }] });

describe('proxy tracking follows the compiled schema', () => {
    it('tracks a declared object assigned after the read, at every depth', () => {
        const row = read(stored());
        row.info = { a: 1, deep: { b: 1 } };
        row.__tracking__!.changes = {};
        row.info.deep.b = 2;

        expect(row.__tracking__!.changes).toEqual({ 'info.deep.b': 2 });
    });

    it('tracks an object inside an element of an array of objects', () => {
        const row = read(stored());
        row.list[0].inner.n = 2;

        expect(row.__tracking__!.changes).toEqual({ 'list.0.inner.n': 2 });
    });

    it('tracks an array inside an array of arrays', () => {
        const row = read(stored());
        row.grid[0][1] = 9;

        expect(row.__tracking__!.changes).toEqual({ 'grid.0.1': 9 });
    });

    it('tracks a push onto an array of primitives assigned after the read', () => {
        const row = read(stored());
        row.tags = ['y'];
        row.__tracking__!.changes = {};
        row.tags.push('z');

        expect(row.__tracking__!.changes).toEqual({ 'tags.1': 'z' });
    });

    it('leaves the elements of an array of files untouched', () => {
        const file = { key: 'f' };
        const row = read({ ...stored(), files: [file] });

        expect(row.files[0]).toBe(file);
    });

    it('leaves a single file untouched', () => {
        const file = { key: 'f' };
        const row = read({ ...stored(), file });

        expect(row.file).toBe(file);
    });
});
