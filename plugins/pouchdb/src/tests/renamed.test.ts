import { describe, it, expect, afterAll } from '@jest/globals';
import PouchDB from 'pouchdb';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { executedQueriesOf } from '@routier/core/plugins';
import { DataStore } from '@routier/datastore';
import { PouchDbPlugin } from '../PouchDbPlugin';

/**
 * Properties declared with `.from()`.
 *
 * PouchDB stores a document in storage shape, renamed properties under their `from` names, and
 * hands rows back that way for the datastore to deserialize. Every read below goes through a
 * FRESH store over the same database: a store that saved the rows still tracks them, and would
 * answer with its own copies whatever the plugin returned.
 *
 * Filters, sorts, projections and groups over a renamed property run the caller's lambdas over
 * stored documents, where the property has another key. So the plugin hands them back, and the
 * datastore finishes the query after deserialization. An aggregate reads the projection in front of
 * it, and goes back with it.
 */
const renamedSchema = s.define('renamed_rows', {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    label: s.string().from('wire_label'),
    amount: s.number().from('wire_amount'),
}).compile();

const nestedSchema = s.define('renamed_nested', {
    _id: s.string().key().identity(),
    payload: s.object({
        inner: s.string().from('wire_inner'),
        plain: s.string(),
    }).from('wire_payload'),
}).compile();

const indexedSchema = s.define('renamed_indexed', {
    _id: s.string().key().identity(),
    code: s.string().index().from('wire_code'),
}).compile();

class RenamedStore extends DataStore {
    rows = this.collection(renamedSchema).proxy().create();
    nested = this.collection(nestedSchema).proxy().create();
}

class IndexedStore extends DataStore {
    rows = this.collection(indexedSchema).proxy().create();
}

const stores: DataStore[] = [];

const track = <T extends DataStore>(store: T) => {
    stores.push(store);

    return store;
};

const database = () => {
    const name = uuidv4();

    return {
        name,
        open: () => track(new RenamedStore(new PouchDbPlugin(name))),
        documents: async () => {
            const response = await new PouchDB(name).allDocs({ include_docs: true });

            return response.rows.map(row => row.doc as unknown as Record<string, unknown>).filter(doc => String(doc._id).startsWith('_design') === false);
        },
    };
};

const seeded = async () => {
    const db = database();
    const store = db.open();

    await store.rows.addAsync(
        { label: 'bravo', amount: 3 } as any,
        { label: 'alpha', amount: 1 } as any,
        { label: 'charlie', amount: 2 } as any,
    );
    await store.saveChangesAsync();

    return db;
};

describe('renamed properties', () => {

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync().catch(() => undefined)));
    });

    it('stores a renamed property under its from name and reads it back', async () => {
        const db = database();
        const store = db.open();
        await store.rows.addAsync({ label: 'hello', amount: 5 } as any);
        await store.saveChangesAsync();

        const [document] = await db.documents();

        expect(document.wire_label).toBe('hello');
        expect(document.wire_amount).toBe(5);
        expect(document).not.toHaveProperty('label');

        const [found] = await db.open().rows.toArrayAsync();

        expect(found.label).toBe('hello');
        expect(found.amount).toBe(5);
    });

    it('echoes an add with its renamed properties', async () => {
        const store = database().open();
        const [added] = await store.rows.addAsync({ label: 'hello', amount: 5 } as any);
        await store.saveChangesAsync();

        expect(added._id).toBeDefined();
        expect(added.label).toBe('hello');
        expect(added.amount).toBe(5);
    });

    it('persists an update that touches only a renamed property', async () => {
        const db = database();
        const store = db.open();
        await store.rows.addAsync({ label: 'before', amount: 5 } as any);
        await store.saveChangesAsync();

        const editor = db.open();
        const [target] = await editor.rows.toArrayAsync();
        target.label = 'after';
        await editor.saveChangesAsync();

        const [document] = await db.documents();

        expect(document.wire_label).toBe('after');
        expect(document.wire_amount).toBe(5);

        const [found] = await db.open().rows.toArrayAsync();

        expect(found.label).toBe('after');
        expect(found.amount).toBe(5);
    });

    it('removes a row read through a renamed schema', async () => {
        const db = await seeded();
        const remover = db.open();
        const target = await remover.rows.firstAsync(r => r.label === 'alpha');

        await remover.rows.removeAsync(target);
        await remover.saveChangesAsync();

        const left = await db.open().rows.toArrayAsync();

        expect(left.map(r => r.label).sort()).toEqual(['bravo', 'charlie']);
    });

    it('filters on a renamed property, and hands the filter back', async () => {
        const db = await seeded();
        const { data, explanation } = await db.open().rows.where(r => r.label === 'bravo').explain().toArrayAsync();

        expect(data.map(r => r.label)).toEqual(['bravo']);
        expect(data[0].amount).toBe(3);
        expect(explanation.summary.reasons).toEqual(['missing-capability']);
    });

    it('sorts on a renamed property, and hands the sort back', async () => {
        const db = await seeded();
        const { data, explanation } = await db.open().rows.sort(r => r.amount).explain().toArrayAsync();

        expect(data.map(r => r.label)).toEqual(['alpha', 'charlie', 'bravo']);
        expect(explanation.summary.reasons).toEqual(['missing-capability']);
    });

    it('filters, sorts and takes over renamed properties, and hands back what follows the filter', async () => {
        const db = await seeded();
        const { data, explanation } = await db.open().rows
            .where(r => r.amount >= 2)
            .sortDescending(r => r.label)
            .take(1)
            .explain()
            .toArrayAsync();

        expect(data.map(r => r.label)).toEqual(['charlie']);
        expect(explanation.summary.reasons).toEqual(['missing-capability', 'not-reached']);
        expect(explanation.summary.memory).toBe(3);
    });

    it('counts a filter on a renamed property', async () => {
        const db = await seeded();

        expect(Number(await db.open().rows.where(r => r.amount >= 2).countAsync())).toBe(2);
    });

    it('maps a renamed property, and hands the map back', async () => {
        const db = await seeded();
        const { data, explanation } = await db.open().rows.map(r => r.label).explain().toArrayAsync();

        expect([...data].sort()).toEqual(['alpha', 'bravo', 'charlie']);
        expect(explanation.summary.reasons).toEqual(['missing-capability']);
    });

    it('maps renamed properties into an object', async () => {
        const db = await seeded();
        const found = await db.open().rows.map(r => ({ name: r.label, total: r.amount })).toArrayAsync();

        expect([...found].sort((a, b) => a.total - b.total)).toEqual([
            { name: 'alpha', total: 1 },
            { name: 'charlie', total: 2 },
            { name: 'bravo', total: 3 },
        ]);
    });

    it('sums a renamed property, handing back the map and the sum behind it', async () => {
        const db = await seeded();
        const { data, explanation } = await db.open().rows.explain().sumAsync(r => r.amount);

        expect(data).toBe(6);
        expect(explanation.summary.reasons).toEqual(['missing-capability', 'not-reached']);
    });

    it('takes the min, max and distinct values of a renamed property', async () => {
        const db = await seeded();

        expect(await db.open().rows.minAsync(r => r.amount)).toBe(1);
        expect(await db.open().rows.maxAsync(r => r.amount)).toBe(3);
        expect([...await db.open().rows.map(r => r.label).distinctAsync()].sort()).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('groups on a renamed property, with the renamed values in each group', async () => {
        const db = await seeded();
        const groups = await db.open().rows.toGroupAsync(r => r.label);

        expect(Object.keys(groups).sort()).toEqual(['alpha', 'bravo', 'charlie']);
        expect(groups['bravo'].map(r => r.amount)).toEqual([3]);
    });

    it('filters and maps over renamed properties', async () => {
        const db = await seeded();
        const found = await db.open().rows.where(r => r.amount >= 2).map(r => r.label).toArrayAsync();

        expect([...found].sort()).toEqual(['bravo', 'charlie']);
    });

    it('keeps a filter that names no renamed property, and still returns the renamed values', async () => {
        const db = await seeded();
        const [first] = await db.open().rows.toArrayAsync();
        const { data, explanation } = await db.open().rows.where(([r, p]) => r._id === p.id, { id: first._id }).explain().toArrayAsync();

        expect(explanation.summary.reasons).toEqual([]);
        expect(data.map(r => r.label)).toEqual([first.label]);
    });

    it('round-trips renamed segments of a nested object', async () => {
        const db = database();
        const store = db.open();
        await store.nested.addAsync({ payload: { inner: 'deep', plain: 'shallow' } } as any);
        await store.saveChangesAsync();

        const [document] = await db.documents();

        expect(document.wire_payload).toEqual({ wire_inner: 'deep', plain: 'shallow' });

        const [found] = await db.open().nested.toArrayAsync();

        expect(found.payload.inner).toBe('deep');
        expect(found.payload.plain).toBe('shallow');

        // Cast because a renamed child of a renamed object is typed as its schema builder in a lambda
        const filtered = await db.open().nested.where(n => (n.payload.inner as unknown) === 'deep').toArrayAsync();

        expect(filtered).toHaveLength(1);
    });

    it('reads a renamed indexed property through its view', async () => {
        const name = uuidv4();
        const store = track(new IndexedStore(new PouchDbPlugin(name)));
        await store.rows.addAsync({ code: 'b' } as any, { code: 'a' } as any);
        await store.saveChangesAsync();

        const { data, explanation } = await track(new IndexedStore(new PouchDbPlugin(name))).rows
            .map(r => r.code)
            .explain()
            .toArrayAsync();

        expect(executedQueriesOf(explanation).map(q => q.text)).toEqual([expect.stringContaining('indexed view query')]);
        expect([...data].sort()).toEqual(['a', 'b']);
    });

    it('refuses an identity key stored under another name', async () => {
        const schema = s.define('renamed_identity', {
            _id: s.string().key().from('wire_id').identity(),
            label: s.string(),
        }).compile();

        class IdentityStore extends DataStore {
            rows = this.collection(schema).proxy().create();
        }

        const store = track(new IdentityStore(new PouchDbPlugin(uuidv4())));
        await store.rows.addAsync({ label: 'x' } as any);

        await expect(store.saveChangesAsync()).rejects.toThrow(/PouchDB generates identity keys as '_id'/);
    });
});
