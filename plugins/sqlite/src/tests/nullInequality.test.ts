import { afterAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

const noteSchema = s.define('null_inequality_notes', {
    _id: s.string().key().identity(),
    name: s.string(),
    note: s.string().nullable(),
    count: s.number().nullable()
}).compile();

class NoteDataStore extends DataStore {
    notes = this.collection(noteSchema).proxy().create();
}

/** SQL `WHERE` drops a row that answers UNKNOWN. JavaScript keeps it. */
describe('inequality against a nullable column', () => {

    const stores: NoteDataStore[] = [];

    const ROWS = [
        { name: 'Alpha', note: null, count: null },
        { name: 'Bravo', note: 'second', count: 3 },
        { name: 'Charlie', note: '', count: 0 },
    ];

    const seeded = async () => {
        const store = new NoteDataStore(new SqliteDbPlugin(`null-ineq-${uuidv4()}.sqlite`));
        stores.push(store);
        await store.notes.addAsync(...(ROWS as any));
        await store.saveChangesAsync();

        return store;
    };

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    const agrees = async (predicate: (row: any) => boolean) => {
        const store = await seeded();
        const found = await store.notes.where(predicate as any).toArrayAsync();

        expect(found.map((row: any) => row.name).toSorted())
            .toEqual(ROWS.filter(predicate).map(row => row.name).toSorted());
    };

    it('keeps a null row on a strict not-equals', async () => {
        await agrees(row => row.note !== 'second');
    });

    it('keeps a null row on a not-equals against an empty string', async () => {
        await agrees(row => row.note !== '');
    });

    it('keeps a null row on a numeric not-equals', async () => {
        await agrees(row => row.count !== 3);
    });

    it('keeps a null row when the compared side is arithmetic', async () => {
        await agrees(row => row.count + 1 !== 4);
    });

    it('still excludes a matching row', async () => {
        await agrees(row => row.note !== 'nothing matches this');
    });
});
