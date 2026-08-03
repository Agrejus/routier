import { beforeEach, describe, expect, it } from '@jest/globals';
import { TagCollection } from './TagCollection';

describe('TagCollection (object keys)', () => {
    let tagCollection: TagCollection;
    let keyCache: Map<string, object>;

    const key = (id: string): object => {
        const existing = keyCache.get(id);
        if (existing != null) {
            return existing;
        }

        const created = { id };
        keyCache.set(id, created);
        return created;
    };

    beforeEach(() => {
        tagCollection = new TagCollection();
        keyCache = new Map<string, object>();
    });

    it('uses object identity for keys', () => {
        const a1 = { id: 1 };
        const a2 = { id: 1 };
        tagCollection.set(a1, 'value');

        expect(tagCollection.has(a1)).toBe(true);
        expect(tagCollection.has(a2)).toBe(false);
        expect(tagCollection.get(a2)).toBeUndefined();
    });

    it('sets and gets values for object keys', () => {
        const k1 = key('k1');
        const k2 = key('k2');

        tagCollection.set(k1, 'value1');
        tagCollection.set(k2, { nested: 'value2' });

        expect(tagCollection.get(k1)).toBe('value1');
        expect(tagCollection.get(k2)).toEqual({ nested: 'value2' });
        expect(tagCollection.size).toBe(2);
    });

    it('overwrites the value without growing size when setting the same key again', () => {
        const k = key('dup');
        tagCollection.set(k, 'old');
        tagCollection.set(k, 'new');

        expect(tagCollection.get(k)).toBe('new');
        expect(tagCollection.size).toBe(1);
    });

    it('deletes object keys and updates size', () => {
        const k1 = key('k1');
        const k2 = key('k2');
        tagCollection.set(k1, 'v1');
        tagCollection.set(k2, 'v2');

        expect(tagCollection.delete(k1)).toBe(true);
        expect(tagCollection.has(k1)).toBe(false);
        expect(tagCollection.size).toBe(1);
        expect(tagCollection.delete(key('missing'))).toBe(false);
        expect(tagCollection.size).toBe(1);
    });

    it('supports setMany with object keys', () => {
        const keys = [key('a'), key('b'), key('c')];
        tagCollection.setMany(keys, 'shared');

        expect(tagCollection.size).toBe(3);
        expect(tagCollection.get(key('a'))).toBe('shared');
        expect(tagCollection.get(key('b'))).toBe('shared');
        expect(tagCollection.get(key('c'))).toBe('shared');
    });

    it('combines with another collection using object keys', () => {
        const k1 = key('k1');
        const k2 = key('k2');
        const k3 = key('k3');
        const other = new TagCollection();

        tagCollection.set(k1, 'one');
        other.set(k2, 'two');
        other.set(k3, 'three');
        tagCollection.combine(other);

        expect(tagCollection.get(k1)).toBe('one');
        expect(tagCollection.get(k2)).toBe('two');
        expect(tagCollection.get(k3)).toBe('three');
        expect(tagCollection.size).toBe(3);
    });

    it('iterates keys/values/entries with object keys', () => {
        const k1 = key('k1');
        const k2 = key('k2');
        tagCollection.set(k1, 'v1');
        tagCollection.set(k2, 'v2');

        const keys = Array.from(tagCollection.keys());
        const values = Array.from(tagCollection.values());
        const entries = Array.from(tagCollection);

        expect(keys).toHaveLength(2);
        expect(keys).toEqual(expect.arrayContaining([k1, k2]));
        expect(values).toEqual(expect.arrayContaining(['v1', 'v2']));
        expect(entries).toEqual(expect.arrayContaining([[k1, 'v1'], [k2, 'v2']]));
    });

    it('clears map data and reported size on dispose', () => {
        const k1 = key('k1');
        const k2 = key('k2');
        tagCollection.set(k1, 'v1');
        tagCollection.set(k2, 'v2');

        tagCollection[Symbol.dispose]();

        expect(tagCollection.has(k1)).toBe(false);
        expect(tagCollection.has(k2)).toBe(false);
        expect(Array.from(tagCollection.keys())).toEqual([]);
        expect(tagCollection.size).toBe(0);
    });

    it('reports size as map cardinality after setMany', () => {
        const keys = [key('x'), key('y')];
        tagCollection.setMany(keys, 'v');

        expect(Array.from(tagCollection.keys())).toHaveLength(2);
        expect(tagCollection.size).toBe(2);
    });

    it('supports function keys (functions are objects)', () => {
        const fn = (): void => { };
        tagCollection.set(fn, 'value');
        expect(tagCollection.has(fn)).toBe(true);
        expect(tagCollection.get(fn)).toBe('value');
    });
});