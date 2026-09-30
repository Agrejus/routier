import { describe, expect, it, jest } from '@jest/globals';
import { etags, s } from '@routier/core/schema';
import { UnknownRecord } from '@routier/core/utilities';
import { stampUpdatedEtags } from './etags';

const withEtag = s.define('dexie_stamp_with', {
    id: s.string().key(),
    version: s.number().etag(etags.numeric),
}).compile();

const withoutEtag = s.define('dexie_stamp_without', {
    id: s.string().key(),
    name: s.string(),
}).compile();

const tableReturning = (rows: (UnknownRecord | undefined)[]) => ({
    bulkGet: jest.fn(async () => rows),
});

describe('stampUpdatedEtags', () => {
    it('does not read stored rows when the schema has no etag', async () => {
        const table = tableReturning([]);
        await stampUpdatedEtags(table, withoutEtag.etagProperty, ['a'], [{ id: 'a', name: 'x' }]);

        expect(table.bulkGet).not.toHaveBeenCalled();
    });

    it('reads the stored rows by key and increments from them', async () => {
        const table = tableReturning([{ id: 'a', version: 4 }, undefined]);
        const updates = [{ id: 'a', version: 4 }, { id: 'b', version: 9 }];
        await stampUpdatedEtags(table, withEtag.etagProperty, ['a', 'b'], updates);

        expect(table.bulkGet).toHaveBeenCalledWith(['a', 'b']);
        expect(updates.map(update => update.version)).toEqual([5, 1]);
    });
});
