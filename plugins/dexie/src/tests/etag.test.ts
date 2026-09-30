import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { etags, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { DexiePlugin } from '../DexiePlugin';

const stringKeySchema = s.define('etag_string_keys', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const numberKeySchema = s.define('etag_number_keys', {
    id: s.number().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const compositeKeySchema = s.define('etag_composite_keys', {
    tenant: s.string().key(),
    code: s.string().key(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const tokenSchema = s.define('etag_tokens', {
    id: s.string().key(),
    name: s.string(),
    revision: s.string().etag(etags.lexical),
}).compile();

class EtagStore extends DataStore {
    stringKeys = this.collection(stringKeySchema).proxy().create();
    numberKeys = this.collection(numberKeySchema).proxy().create();
    compositeKeys = this.collection(compositeKeySchema).proxy().create();
    tokens = this.collection(tokenSchema).proxy().create();
}

const stores: DataStore[] = [];

const open = (name: string) => {
    const store = new EtagStore(new DexiePlugin(name));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

const required = <T>(value: T | undefined): T => {
    if (value == null) {
        throw new Error('expected a value');
    }

    return value;
};

describe('etag on the Dexie plugin', () => {
    it('sets a number etag to 1 on insert with a generated string key', async () => {
        const store = open(`etag-${uuidv4()}-db`);
        const [added] = await store.stringKeys.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        expect(added?.version).toBe(1);
    });

    it('sets a number etag to 1 on insert with a key Dexie generates', async () => {
        const store = open(`etag-${uuidv4()}-db`);
        const [added] = await store.numberKeys.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        expect(added?.version).toBe(1);
    });

    it('increments a number etag on every update and stores it', async () => {
        const name = `etag-${uuidv4()}-db`;
        const store = open(name);
        const added = required((await store.stringKeys.addAsync({ name: 'first' }))[0]);
        await store.saveChangesAsync();

        added.name = 'second';
        await store.saveChangesAsync();
        added.name = 'third';
        await store.saveChangesAsync();

        const [stored] = await open(name).stringKeys.toArrayAsync();

        expect([added.version, stored?.version]).toEqual([3, 3]);
    });

    it('increments the etag of the right row under a composite key', async () => {
        const store = open(`etag-${uuidv4()}-db`);
        const [first, second] = await store.compositeKeys.addAsync(
            { tenant: 't', code: 'a', name: 'first' },
            { tenant: 't', code: 'b', name: 'second' },
        );
        await store.saveChangesAsync();

        required(second).name = 'changed';
        await store.saveChangesAsync();

        expect([first?.version, second?.version]).toEqual([1, 2]);
    });

    it('still removes rows by key', async () => {
        const store = open(`etag-${uuidv4()}-db`);
        const [first] = await store.compositeKeys.addAsync(
            { tenant: 't', code: 'a', name: 'first' },
            { tenant: 't', code: 'b', name: 'second' },
        );
        await store.saveChangesAsync();

        await store.compositeKeys.removeAsync(required(first));
        await store.saveChangesAsync();

        expect((await store.compositeKeys.toArrayAsync()).map(row => row.code)).toEqual(['b']);
    });

    it('replaces a string etag with a newer one on update', async () => {
        const store = open(`etag-${uuidv4()}-db`);
        const added = required((await store.tokens.addAsync({ id: 'a', name: 'first' }))[0]);
        await store.saveChangesAsync();

        const inserted = added.revision;
        added.name = 'second';
        await store.saveChangesAsync();

        expect(etags.lexical(inserted, added.revision)).toBe(-1);
    });
});
