import { describe, it, expect, afterAll } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { PouchDbPlugin } from '../PouchDbPlugin';

/**
 * Queries over `.from()` properties.
 *
 * Core leaves these with the database now, and PouchDB matches and sorts with the caller's lambdas
 * over documents as they are stored, where the property has another key. So the plugin hands them
 * back, and the datastore finishes the query after deserialization.
 *
 * These assert the hand-back, not the rows. A renamed property does not survive a PouchDB round trip
 * today — a plain `toArrayAsync()` with no options returns it as `undefined` — so no read over one
 * can come back right until that is fixed, whichever side runs the filter.
 */
const renamedSchema = s.define('renamed_rows', {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    label: s.string().from('wire_label'),
    amount: s.number().from('wire_amount'),
}).compile();

class RenamedStore extends DataStore {
    rows = this.collection(renamedSchema).proxy().create();
}

const stores: DataStore[] = [];

const opened = () => {
    const store = new RenamedStore(new PouchDbPlugin(uuidv4()));
    stores.push(store);

    return store;
};

describe('renamed properties', () => {

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync().catch(() => undefined)));
    });

    it('hands back a filter on a renamed property, and what follows it', async () => {
        const { explanation } = await opened().rows
            .where(r => r.label === 'bravo')
            .sort(r => r.amount)
            .take(1)
            .explain()
            .toArrayAsync();

        expect(explanation.summary.reasons).toEqual(['missing-capability', 'not-reached']);
        expect(explanation.summary.memory).toBe(3);
    });

    it('hands back a sort on a renamed property', async () => {
        const { explanation } = await opened().rows.sort(r => r.amount).explain().toArrayAsync();

        expect(explanation.summary.reasons).toEqual(['missing-capability']);
    });

    it('keeps a filter that names no renamed property', async () => {
        const { explanation } = await opened().rows.where(r => r._id === 'x').explain().toArrayAsync();

        expect(explanation.summary.reasons).toEqual([]);
    });
});
