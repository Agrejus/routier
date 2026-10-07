import { describe, expect, it } from '@jest/globals';
import { runInNewContext } from 'node:vm';
import { createChangeTracker } from './changeTracker';

type Tracked = Record<string, any> & { __tracking__?: { changes: Record<string, unknown>; original: Record<string, unknown>; isDirty: boolean; isPaused: boolean } };

const shape = {
    objects: new Set(['info', 'info.deep', 'v2', '3d']),
    arrays: new Set(['list', 'grid', 'tags', 'files', 'rows']),
    arraysOfNested: new Set(['list', 'grid', 'rows']),
};

const tracked = (entity: Record<string, unknown>): Tracked => createChangeTracker(shape)(entity) as Tracked;

const isProxy = (value: unknown) => (value as Record<string, unknown>).__isProxy__ === true;

describe('createChangeTracker', () => {
    describe('deleting a property', () => {
        it('records the removal against its original value', () => {
            const entity = tracked({ label: 'y' });
            delete entity.label;

            expect(entity.__tracking__).toEqual({ changes: { label: undefined }, original: { label: 'y' }, isDirty: true, isPaused: false });
            expect('label' in entity).toBe(false);
        });

        it('records nothing for a property that is not there', () => {
            const entity = tracked({});
            delete entity.label;

            expect(entity.__tracking__).toBeUndefined();
        });

        it('records nothing while tracking is paused', () => {
            const entity = tracked({ label: 'y' });
            entity.other = 1;
            entity.__tracking__!.isPaused = true;
            delete entity.label;

            expect(entity.__tracking__!.changes).toEqual({ other: 1 });
        });

        it('is clean again once the value is put back', () => {
            const entity = tracked({ label: 'y' });
            delete entity.label;
            entity.label = 'y';

            expect(entity.__tracking__).toEqual({ changes: {}, original: {}, isDirty: false, isPaused: false });
        });
    });

    describe('setting a property', () => {
        it('is clean again after a value goes to null and back', () => {
            const entity = tracked({ note: 'x' });
            entity.note = null;
            entity.note = 'x';

            expect(entity.__tracking__!.isDirty).toBe(false);
        });

        it('keeps the first original across several changes', () => {
            const entity = tracked({ note: 'x' });
            entity.note = 'y';
            entity.note = 'z';

            expect(entity.__tracking__).toEqual({ changes: { note: 'z' }, original: { note: 'x' }, isDirty: true, isPaused: false });
        });

        it('ignores a write that changes nothing', () => {
            const entity = tracked({ note: 'x' });
            entity.note = 'x';

            expect(entity.__tracking__).toBeUndefined();
        });

        it('ignores a write to the tracking record through the proxy', () => {
            const entity = tracked({ note: 'x' });
            entity.__tracking__ = { changes: { forged: true }, original: {}, isDirty: true, isPaused: false };

            expect(entity.__tracking__).toEqual({ changes: {}, original: {}, isDirty: false, isPaused: false });
        });
    });

    describe('reading a nested value', () => {
        it('tracks a declared object against the root under its full path', () => {
            const entity = tracked({ info: { deep: { a: 1 } } });
            entity.info.deep.a = 2;

            expect(entity.__tracking__!.changes).toEqual({ 'info.deep.a': 2 });
        });

        it('tracks an object inside a declared array, under its index', () => {
            const entity = tracked({ list: [{ k: 'one' }] });
            entity.list[0].k = 'two';

            expect(entity.__tracking__!.changes).toEqual({ 'list.0.k': 'two' });
        });

        it('tracks an array inside a declared array', () => {
            const entity = tracked({ grid: [[1, 2]] });
            entity.grid[0][1] = 9;

            expect(entity.__tracking__!.changes).toEqual({ 'grid.0.1': 9 });
        });

        it('hands back the same proxy every time', () => {
            const entity = tracked({ info: { deep: {} } });

            expect(entity.info).toBe(entity.info);
        });

        it('leaves an undeclared object alone', () => {
            const content = { bytes: 'abc' };
            const entity = tracked({ file: content });

            expect(entity.file).toBe(content);
        });

        it('leaves the elements of an undeclared array alone', () => {
            const element = { k: 'one' };
            const entity = tracked({ other: [element] });

            expect(entity.other[0]).toBe(element);
        });

        it('leaves the elements of an array of leaf values alone', () => {
            const file = { bytes: 'abc' };
            const entity = tracked({ files: [file] });

            expect(entity.files[0]).toBe(file);
        });

        it('tracks a push onto a declared array assigned after reading', () => {
            const entity = tracked({});
            entity.tags = ['a'];
            Object.defineProperty(entity, '__tracking__', { value: undefined, configurable: true, writable: true, enumerable: false });
            entity.tags.push('b');

            expect(entity.__tracking__!.changes).toEqual({ 'tags.1': 'b' });
        });

        it('leaves a date alone', () => {
            const when = new Date(0);
            const entity = tracked({ info: when });

            expect(entity.info).toBe(when);
        });

        it('leaves a class instance alone', () => {
            const map = new Map();
            const entity = tracked({ info: map });

            expect(entity.info).toBe(map);
        });

        it('tracks an object made in another realm', () => {
            const entity = tracked({ info: runInNewContext('({ deep: { a: 1 } })') });

            expect(isProxy(entity.info)).toBe(true);
        });

        it('tracks an object with no prototype', () => {
            const entity = tracked({ info: Object.assign(Object.create(null), { a: 1 }) });

            expect(isProxy(entity.info)).toBe(true);
        });

        it('does not wrap the tracking record', () => {
            const entity = tracked({ note: 'x' });
            entity.note = 'y';

            expect(isProxy(entity.__tracking__)).toBe(false);
        });

        it('passes a symbol key straight through', () => {
            const key = Symbol('key');
            const value = { a: 1 };
            const entity = tracked({ [key]: value } as Record<string, unknown>);

            expect((entity as Record<symbol, unknown>)[key]).toBe(value);
        });
    });

    describe('matching a path to the schema', () => {
        it('strips an index of two digits', () => {
            const list = Array.from({ length: 11 }, (_, i) => ({ k: `${i}` }));
            const entity = tracked({ list });
            entity.list[10].k = 'ten';

            expect(entity.__tracking__!.changes).toEqual({ 'list.10.k': 'ten' });
        });

        it.each(['v2', '3d'])('keeps a declared name with digits in it: %s', name => {
            const entity = tracked({ [name]: { a: 1 } });
            entity[name].a = 2;

            expect(entity.__tracking__!.changes).toEqual({ [`${name}.a`]: 2 });
        });

        it('tracks an undeclared object inside an element of a declared array', () => {
            const entity = tracked({ rows: [{ inner: { n: 1 } }] });
            entity.rows[0].inner.n = 2;

            expect(entity.__tracking__!.changes).toEqual({ 'rows.0.inner.n': 2 });
        });

        it('does not wrap an object whose path only ends like a declared array', () => {
            const value = { n: 1 };
            const entity = tracked({ other: { list: value } });

            expect(entity.other.list).toBe(value);
        });
    });

    describe('the tracking record', () => {
        it('is defined writable and hidden from enumeration', () => {
            const entity = tracked({ note: 'x' });
            entity.note = 'y';

            expect(Object.getOwnPropertyDescriptor(entity, '__tracking__')).toMatchObject({ writable: true, enumerable: false, configurable: true });
            expect(Object.keys(entity)).toEqual(['note']);
        });
    });

    describe('values that are already tracked', () => {
        it('hands back a tracked value instead of wrapping it again', () => {
            const root: Record<string, unknown> = {};
            const inner = createChangeTracker(shape)<Record<string, unknown>>({ a: 1 }, 'info', root);
            const entity = tracked({});
            entity.info = inner;

            expect(entity.info).toBe(inner);
        });
    });

    describe('deleting a symbol', () => {
        it('deletes it without recording anything', () => {
            const key = Symbol('key');
            const entity = tracked({ [key]: 1 } as Record<string, unknown>);

            expect(() => delete (entity as Record<symbol, unknown>)[key]).not.toThrow();
            expect(key in entity).toBe(false);
            expect(entity.__tracking__).toBeUndefined();
        });
    });
});
