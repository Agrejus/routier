import { afterAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ConcurrencyDbPlugin, IDbPlugin, OptimisticConcurrencyError, uuidv4 } from '@routier/core';
import { etags, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { describeEtagContract } from '@routier/test-utils';
import { D1DbPlugin } from '../d1';
import { SqliteDbPlugin } from '../index';
import { FakeD1Database } from './FakeD1Database';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-etag-'));
const databases: FakeD1Database[] = [];

const openD1 = () => {
    const database = new FakeD1Database();
    databases.push(database);
    return database;
};

afterAll(() => {
    for (const database of databases.splice(0)) {
        database.close();
    }

    fs.rmSync(root, { recursive: true, force: true });
});

describeEtagContract('sqlite', () => new SqliteDbPlugin(path.join(root, `${uuidv4()}.sqlite`)));

describeEtagContract('cloudflare d1', () => new D1DbPlugin(openD1(), { deleteDatabase: async () => undefined }), { supportsConcurrency: false });

const accounts = s.define('occ_etag_accounts', {
    _id: s.string().key().identity(),
    balance: s.number(),
    version: s.number().etag(etags.numeric),
}).compile();

class AccountStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    accounts = this.collection(accounts).proxy().create();
}

describe('ConcurrencyDbPlugin over SQLite with a declared etag', () => {
    it('rejects a write made from a stale etag and keeps the first write', async () => {
        const file = path.join(root, `${uuidv4()}.sqlite`);
        const open = () => new AccountStore(new ConcurrencyDbPlugin(new SqliteDbPlugin(file)));
        const seeder = open();
        const [seeded] = await seeder.accounts.addAsync({ balance: 1000 });
        await seeder.saveChangesAsync();
        const id = seeded?._id ?? '';
        const writerA = open();
        const writerB = open();
        const a = await writerA.accounts.firstAsync(([x, p]) => x._id === p.id, { id });
        const b = await writerB.accounts.firstAsync(([x, p]) => x._id === p.id, { id });

        a.balance = 900;
        await writerA.saveChangesAsync();
        b.balance = 1100;

        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);
        expect(await open().accounts.firstAsync(([x, p]) => x._id === p.id, { id })).toEqual(expect.objectContaining({ balance: 900, version: 2 }));
    });

    it('adds no hidden version column to the table', async () => {
        const file = path.join(root, `${uuidv4()}.sqlite`);
        const store = new AccountStore(new ConcurrencyDbPlugin(new SqliteDbPlugin(file)));
        await store.accounts.addAsync({ balance: 1000 });
        await store.saveChangesAsync();
        await store.accounts.toArrayAsync();

        const database = new DatabaseSync(file);
        const columns = database.prepare('PRAGMA table_info(occ_etag_accounts)').all().map(column => column.name);
        database.close();

        expect(columns.sort()).toEqual(['_id', 'balance', 'version']);
    });
});
