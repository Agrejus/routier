import { afterAll, describe, expect, it } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { etags, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';

const numberSchema = s.define('etag_numbers', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const diffNumberSchema = s.define('etag_diff_numbers', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const immutableNumberSchema = s.define('etag_immutable_numbers', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const tokenSchema = s.define('etag_tokens', {
    id: s.string().key().identity(),
    name: s.string(),
    revision: s.string().etag(etags.lexical),
}).compile();

class EtagStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    numbers = this.collection(numberSchema).proxy().create();
    diffNumbers = this.collection(diffNumberSchema).diff().create();
    immutableNumbers = this.collection(immutableNumberSchema).immutable().create();
    tokens = this.collection(tokenSchema).proxy().create();
}

const stores: EtagStore[] = [];
const createStore = () => {
    const store = new EtagStore(new MemoryPlugin(uuidv4()));
    stores.push(store);
    return store;
};

describe('etag on the memory plugin', () => {
    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    it('sets a number etag to 1 on insert', async () => {
        const store = createStore();
        const [added] = await store.numbers.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        expect(added?.version).toBe(1);
    });

    it('stores the etag it set on insert', async () => {
        const store = createStore();
        await store.numbers.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        const [stored] = await store.numbers.toArrayAsync();

        expect(stored?.version).toBe(1);
    });

    it('increments a number etag on every update', async () => {
        const store = createStore();
        const [added] = await store.numbers.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        if (added == null) {
            throw new Error('nothing was added');
        }

        added.name = 'second';
        await store.saveChangesAsync();
        added.name = 'third';
        await store.saveChangesAsync();

        const [stored] = await store.numbers.toArrayAsync();

        expect([added.version, stored?.version]).toEqual([3, 3]);
    });

    it('increments a number etag in a diff-tracked collection', async () => {
        const store = createStore();
        const [added] = await store.diffNumbers.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        if (added == null) {
            throw new Error('nothing was added');
        }

        added.name = 'second';
        await store.saveChangesAsync();

        const [stored] = await store.diffNumbers.toArrayAsync();

        expect([added.version, stored?.version]).toEqual([2, 2]);
    });

    it('increments a number etag in an immutable collection', async () => {
        const store = createStore();
        const [added] = await store.immutableNumbers.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        if (added == null) {
            throw new Error('nothing was added');
        }

        store.immutableNumbers.update(added, { name: 'second' });
        await store.saveChangesAsync();

        const [stored] = await store.immutableNumbers.toArrayAsync();

        expect(stored?.version).toBe(2);
    });

    it('leaves the etag alone when nothing changed', async () => {
        const store = createStore();
        await store.numbers.addAsync({ name: 'first' });
        await store.saveChangesAsync();
        await store.saveChangesAsync();

        const [stored] = await store.numbers.toArrayAsync();

        expect(stored?.version).toBe(1);
    });

    it('gives each inserted row its own number etag starting at 1', async () => {
        const store = createStore();
        const added = await store.numbers.addAsync({ name: 'a' }, { name: 'b' });
        await store.saveChangesAsync();

        expect(added.map(row => row.version)).toEqual([1, 1]);
    });

    it('sets a string etag on insert', async () => {
        const store = createStore();
        const [added] = await store.tokens.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        expect(added?.revision).toMatch(/^[0-9a-z]{15}$/);
    });

    it('replaces a string etag with a newer one on update', async () => {
        const store = createStore();
        const [added] = await store.tokens.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        if (added == null) {
            throw new Error('nothing was added');
        }

        const inserted = added.revision;
        added.name = 'second';
        await store.saveChangesAsync();

        expect(etags.lexical(inserted, added.revision)).toBe(-1);
    });
});
