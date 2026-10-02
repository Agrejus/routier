import { describe, expect, it, jest } from '@jest/globals';
import { etags, s } from '@routier/core/schema';
import { stampUpdatedEtags, withEtag } from './etags';

const versioned = s.define('mongo_etags', {
    _id: s.string().key(),
    version: s.number().etag(etags.numeric),
}).compile();

const collectionReturning = (documents: Record<string, unknown>[]) => ({
    find: jest.fn(async () => documents),
});

describe('stampUpdatedEtags', () => {
    it('does not read stored documents without an etag to generate', async () => {
        const collection = collectionReturning([]);

        await stampUpdatedEtags(collection, null, [{ _id: 'a' }]);

        expect(collection.find).not.toHaveBeenCalled();
    });

    it('reads the stored documents by id and increments from them', async () => {
        const collection = collectionReturning([{ _id: 'b', version: 4 }, { _id: 'a', version: 1 }]);
        const entities = [{ _id: 'a', version: 9 }, { _id: 'b', version: 9 }, { _id: 'c', version: 9 }];

        await stampUpdatedEtags(collection, versioned.etagProperty, entities);

        expect(collection.find).toHaveBeenCalledWith({ _id: { $in: ['a', 'b', 'c'] } });
        expect(entities.map(entity => entity.version)).toEqual([2, 5, 1]);
    });
});

describe('withEtag', () => {
    it('adds nothing without an etag', () => {
        const set = { name: 'x' };

        expect(withEtag(set, undefined, { name: 'x', version: 3 })).toBe(set);
    });

    it('sets the etag the entity carries', () => {
        expect(withEtag({ name: 'x', version: 9 }, 'version', { version: 3 })).toEqual({ name: 'x', version: 3 });
    });
});
