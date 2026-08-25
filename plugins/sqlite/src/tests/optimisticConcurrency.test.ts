import { afterAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { ConcurrencyDbPlugin, OptimisticConcurrencyError } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';
import { uuidv4 } from '@routier/core';
import fs from 'fs';

/**
 * ConcurrencyDbPlugin against a real SQLite file: the hidden `__version` column lands in
 * the DDL via the augmented schema view, the token-checked UPDATE affects zero rows when
 * the stored token moved, and the save reports the conflict instead of committing.
 */

const schema = s.define('occ_sqlite_accounts', {
    id: s.string().key().identity(),
    balance: s.number(),
}).compile();

class Store extends DataStore {
    accounts = this.collection(schema).proxy().create();
}

const files: string[] = [];
const database = () => {
    const file = `occ-sqlite-${uuidv4()}.db`;
    files.push(file);
    return file;
};

afterAll(() => {
    for (const file of files.splice(0)) {
        try { fs.unlinkSync(file); } catch { /* already gone */ }
    }
});

describe('sqlite optimistic concurrency', () => {
    it('rejects a stale write, preserves the winner, and allows a retry', async () => {
        const file = database();
        const writerA = new Store(new ConcurrencyDbPlugin(new SqliteDbPlugin(file)));
        const writerB = new Store(new ConcurrencyDbPlugin(new SqliteDbPlugin(file)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(a.__version).toBeUndefined();
        expect(b.__version).toBeUndefined();

        a.balance = 900;
        await writerA.saveChangesAsync();

        b.balance = 1100;
        const error = await writerB.saveChangesAsync().then((): any => null, (e: any) => e);

        expect(OptimisticConcurrencyError.is(error)).toBe(true);
        expect(error.conflicts).toEqual([id]);

        // The winner's write survived the loser's rolled-back save
        const fresh: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(fresh.balance).toBe(900);

        // Retry from the fresh read succeeds
        fresh.balance = fresh.balance - 250;
        await writerB.saveChangesAsync();

        const final: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(final.balance).toBe(650);

        writerA[Symbol.dispose]();
        writerB[Symbol.dispose]();
    });
});
