import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s, SchemaTypes } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';
import { schemaView } from './index';

const reverse = (value: string) => [...value].reverse().join('');

const nameCipher = {
    to: (value: string) => `enc:${reverse(value)}`,
    from: (stored: unknown) => reverse(String(stored).slice(4)),
    stores: SchemaTypes.String,
    comparable: 'equality' as const,
};

const scoreCodec = {
    to: (value: number) => `n:${value}`,
    from: (stored: unknown) => Number(String(stored).slice(2)),
    stores: SchemaTypes.String,
};

const secretSchema = s.define('transformed_secrets', {
    id: s.string().key(),
    name: s.string(),
    score: s.number(),
    note: s.string(),
}).modify(x => ({
    name: x.transform(nameCipher),
    score: x.transform(scoreCodec),
})).compile();

const rawSchema = s.define('transformed_secrets', {
    id: s.string().key(),
    name: s.string(),
    score: s.string(),
    note: s.string(),
}).compile();

class SecretStore extends DataStore {
    secrets = this.collection(secretSchema).proxy().create();
}

class RawStore extends DataStore {
    secrets = this.collection(rawSchema).proxy().create();
}

const stores: DataStore[] = [];

const open = () => {
    const databaseName = `transforms-${uuidv4()}`;
    const store = new SecretStore(new MemoryPlugin(databaseName));
    const raw = new RawStore(new MemoryPlugin(databaseName));

    stores.push(store, raw);

    return { store, raw };
};

const seeded = async () => {
    const opened = open();

    await opened.store.secrets.addAsync(
        { id: '1', name: 'alpha', score: 1, note: 'a' },
        { id: '2', name: 'beta', score: 2, note: 'b' },
    );
    await opened.store.saveChangesAsync();

    return opened;
};

const storedRows = async (raw: RawStore) =>
    (await raw.secrets.sort(x => x.id).toArrayAsync()).map(row => ({ name: row.name, score: row.score }));

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('transforms around a save and a query', () => {

    it('stores every transformed property of every added row in its stored form', async () => {
        const { raw } = await seeded();

        expect(await storedRows(raw)).toEqual([
            { name: 'enc:ahpla', score: 'n:1' },
            { name: 'enc:ateb', score: 'n:2' },
        ]);
    });

    it('stores every transformed property of every updated row in its stored form', async () => {
        const { store, raw } = await seeded();

        const rows = await store.secrets.sort(x => x.id).toArrayAsync();

        for (const row of rows) {
            row.name = `${row.name}!`;
            row.score = row.score * 10;
        }

        await store.saveChangesAsync();

        expect(await storedRows(raw)).toEqual([
            { name: 'enc:!ahpla', score: 'n:10' },
            { name: 'enc:!ateb', score: 'n:20' },
        ]);
    });

    it('reads every transformed property of every row back as the application value', async () => {
        const { store } = await seeded();

        const rows = await store.secrets.sort(x => x.id).toArrayAsync();

        expect(rows.map(row => ({ name: row.name, score: row.score }))).toEqual([
            { name: 'alpha', score: 1 },
            { name: 'beta', score: 2 },
        ]);
    });

    it('matches a transformed property compared inside a compound filter', async () => {
        const { store } = await seeded();

        const found = await store.secrets
            .where(([x, p]) => x.note === p.note && x.name === p.name, { note: 'b', name: 'beta' })
            .toArrayAsync();

        expect(found.map(row => row.id)).toEqual(['2']);
    });
});

describe('schemaView', () => {

    it('types a property whose transform stores another type as that type', () => {
        const viewedSchema = s.define('transformed_view', {
            id: s.string().key(),
            score: s.number(),
        }).modify(x => ({
            score: x.transform(scoreCodec),
        })).compile();

        const score = schemaView(viewedSchema).properties.find(property => property.name === 'score');

        expect(score?.type).toBe(SchemaTypes.String);
    });
});
