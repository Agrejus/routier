import { describe, it, expect } from '@jest/globals';
import { MemoryDataCollection } from './MemoryDataCollection';
import { s } from '../schema';

describe('MemoryDataCollection keys', () => {
    const composite = s.define('memory_composite_keys', {
        tenant: s.string().key(),
        code: s.string().key(),
        name: s.string(),
    }).compile();

    const single = s.define('memory_single_key', {
        code: s.string().key(),
        name: s.string(),
    }).compile();

    const seeded = () => {
        const collection = new MemoryDataCollection(composite);
        collection.add({ tenant: 't', code: '1', name: 'first' });
        collection.add({ tenant: 't', code: '2', name: 'second' });
        return collection;
    };

    it('keeps two rows that share only the first part of a composite key', () => {
        const collection = seeded();

        expect(collection.records).toHaveLength(2);
        expect(collection.getByIds(['t', '1'])).toEqual({ tenant: 't', code: '1', name: 'first' });
        expect(collection.getByIds(['t', '2'])).toEqual({ tenant: 't', code: '2', name: 'second' });
    });

    it('updates only the row matching every part of a composite key', () => {
        const collection = seeded();

        collection.update({ tenant: 't', code: '2', name: 'changed' });

        expect(collection.getByIds(['t', '1'])).toEqual({ tenant: 't', code: '1', name: 'first' });
        expect(collection.getByIds(['t', '2'])).toEqual({ tenant: 't', code: '2', name: 'changed' });
    });

    it('removes only the row matching every part of a composite key', () => {
        const collection = seeded();

        collection.remove({ tenant: 't', code: '2', name: 'second' });

        expect(collection.records).toEqual([{ tenant: 't', code: '1', name: 'first' }]);
    });

    it('finds nothing for a composite key matching only its first part', () => {
        expect(seeded().getByIds(['t', '3'])).toBeUndefined();
    });

    it('finds a row by a single key', () => {
        const collection = new MemoryDataCollection(single);
        collection.add({ code: 'a', name: 'only' });

        expect(collection.getByIds(['a'])).toEqual({ code: 'a', name: 'only' });
        expect(collection.getByIds(['b'])).toBeUndefined();
    });
});
