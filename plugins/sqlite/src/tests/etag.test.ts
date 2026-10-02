import { afterAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ConcurrencyDbPlugin, IDbPlugin, OptimisticConcurrencyError, uuidv4 } from '@routier/core';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { Result } from '@routier/core/results';
import { etags, InferRoot, s } from '@routier/core/schema';
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

describe('ConcurrencyDbPlugin over D1 with a declared etag', () => {
    it('refuses the guarded save', async () => {
        const store = new AccountStore(new ConcurrencyDbPlugin(new D1DbPlugin(openD1(), { deleteDatabase: async () => undefined })));
        await store.accounts.addAsync({ balance: 1000 });
        await store.saveChangesAsync();
        const [row] = await store.accounts.toArrayAsync();

        if (row == null) {
            throw new Error('nothing stored');
        }

        row.balance = 900;

        await expect(store.saveChangesAsync()).rejects.toThrow(
            'Cloudflare D1 cannot support optimistic concurrency, so ConcurrencyDbPlugin must not wrap D1DbPlugin.  ' +
            "A token check requires reading a statement's affected-row count mid-transaction, and D1's batch() applies every statement without stopping to look.  " +
            'Collection: occ_etag_accounts'
        );
    });

    it('names the schema id when the event does not carry the schema', async () => {
        const plugin = new D1DbPlugin(openD1(), { deleteDatabase: async () => undefined });
        const operation = new BulkPersistChanges();
        operation.resolve<InferRoot<typeof accounts>>(accounts.id).updates.push({ entity: { _id: 'a', balance: 1, version: 1 }, changeType: 'markedDirty', delta: {}, concurrency: { column: 'version', expected: 1 } });

        const outcome = await new Promise<string>(resolve => plugin.bulkPersist(
            { id: 'guarded', schemas: new SchemaCollection(), operation, source: 'test', action: 'persist' },
            result => resolve(result.ok === Result.ERROR ? String(result.error) : 'saved'),
        ));

        expect(outcome).toContain(`Collection: ${accounts.id}`);
    });
});
