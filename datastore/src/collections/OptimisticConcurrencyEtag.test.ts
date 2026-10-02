import { afterEach, describe, expect, it } from '@jest/globals';
import { ConcurrencyDbPlugin, IDbPlugin, OptimisticConcurrencyError } from '@routier/core';
import { etags, s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const numbered = s.define('occ_etag_accounts', {
    id: s.string().key().identity(),
    balance: s.number(),
    version: s.number().etag(etags.numeric).optional(),
}).compile();

const tokened = s.define('occ_etag_notes', {
    id: s.string().key().identity(),
    body: s.string(),
    revision: s.string().etag(etags.lexical),
}).compile();

class Store extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    accounts = this.collection(numbered).proxy().create();
    notes = this.collection(tokened).proxy().create();
}

const stores: DataStore[] = [];
const open = (database: string, guarded = true) => {
    const plugin = new MemoryPlugin(database);
    const store = new Store(guarded ? new ConcurrencyDbPlugin(plugin) : plugin);
    stores.push(store);
    return store;
};

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const required = <T>(value: T | undefined): T => {
    if (value == null) {
        throw new Error('expected a value');
    }

    return value;
};

const seedAccount = async (database: string) => {
    const writer = open(database);
    const seeded = required((await writer.accounts.addAsync({ balance: 1000 }))[0]);
    await writer.saveChangesAsync();
    return seeded.id;
};

const readAccount = async (store: Store, id: string) =>
    required(await store.accounts.firstOrUndefinedAsync(([x, p]) => x.id === p.id, { id }));

describe('ConcurrencyDbPlugin with a declared etag', () => {
    it('rejects a write made from a stale number etag and keeps the first write', async () => {
        const database = `occ-etag-${Math.random()}`;
        const id = await seedAccount(database);
        const writerA = open(database);
        const writerB = open(database);
        const a = await readAccount(writerA, id);
        const b = await readAccount(writerB, id);

        a.balance = 900;
        await writerA.saveChangesAsync();
        b.balance = 1100;

        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);
        expect((await readAccount(open(database), id)).balance).toBe(900);
    });

    it('rejects a write made from a stale string etag', async () => {
        const database = `occ-etag-${Math.random()}`;
        const writer = open(database);
        const seeded = required((await writer.notes.addAsync({ body: 'first' }))[0]);
        await writer.saveChangesAsync();
        const writerA = open(database);
        const writerB = open(database);
        const a = required(await writerA.notes.firstOrUndefinedAsync(([x, p]) => x.id === p.id, { id: seeded.id }));
        const b = required(await writerB.notes.firstOrUndefinedAsync(([x, p]) => x.id === p.id, { id: seeded.id }));

        a.body = 'second';
        await writerA.saveChangesAsync();
        b.body = 'stale';

        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);
    });

    it('accepts a retry made from a fresh read', async () => {
        const database = `occ-etag-${Math.random()}`;
        const id = await seedAccount(database);
        const writerA = open(database);
        const a = await readAccount(writerA, id);
        a.balance = 900;
        await writerA.saveChangesAsync();

        const writerB = open(database);
        const b = await readAccount(writerB, id);
        b.balance = 1100;
        await writerB.saveChangesAsync();

        expect(await readAccount(open(database), id)).toEqual(expect.objectContaining({ balance: 1100, version: 3 }));
    });

    it('stores no hidden version column', async () => {
        const database = `occ-etag-${Math.random()}`;
        const id = await seedAccount(database);

        const stored = await readAccount(open(database, false), id);

        expect(Object.keys(stored).sort()).toEqual(['balance', 'id', 'version']);
    });

    it('does not guard a row that has no etag yet', async () => {
        const database = `occ-etag-${Math.random()}`;
        const plugin = new MemoryPlugin(database);
        plugin.seed(numbered, [{ id: 'a', balance: 1000 }]);
        const writerA = open(database);
        const writerB = open(database);
        const a = await readAccount(writerA, 'a');
        const b = await readAccount(writerB, 'a');

        a.balance = 900;
        await writerA.saveChangesAsync();
        b.balance = 1100;
        await writerB.saveChangesAsync();

        expect((await readAccount(open(database), 'a')).balance).toBe(1100);
    });
});
