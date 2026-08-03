import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { OptimisticConcurrencyError } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `.concurrency()` end to end — the feature the finance stress app proved missing.
 *
 * Two writers read the same row; both write. Without a token the second write silently
 * overwrites the first (the lost update that showed up as invariant drift). With a token
 * the second save FAILS with a conflict naming the row, the caller re-reads and retries,
 * and no write is ever silently lost.
 */

const schema = s.define('occ_accounts', {
    id: s.string().key().identity(),
    balance: s.number(),
    version: s.number(),
}).compile();

class Store extends DataStore {
    accounts = this.collection(schema).proxy().concurrency(x => (x as any).version).create();
}

class DiffStore extends DataStore {
    accounts = this.collection(schema).diff().concurrency(x => (x as any).version).create();
}

const stores: DataStore[] = [];
const track = <T extends DataStore>(store: T) => { stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store[Symbol.dispose](); });

const database = () => `occ-${Math.random()}`;

describe('token lifecycle', () => {
    it('starts at 1 on add and bumps on every saved update', async () => {
        const store = track(new Store(new MemoryPlugin(database())));

        const [account]: any[] = await store.accounts.addAsync({ balance: 100 } as any);
        await store.saveChangesAsync();
        expect(account.version).toBe(1);

        account.balance = 90;
        await store.saveChangesAsync();
        expect(account.version).toBe(2);

        account.balance = 80;
        await store.saveChangesAsync();
        expect(account.version).toBe(3);
    });
});

describe('conflict detection (proxy mode)', () => {
    it('rejects the second writer and preserves the first write', async () => {
        const db = database();
        const writerA = track(new Store(new MemoryPlugin(db)));
        const writerB = track(new Store(new MemoryPlugin(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();

        // Both writers read version 1
        const a: any = await writerA.accounts.firstAsync(x => x.id === (seeded as any).id);
        const b: any = await writerB.accounts.firstAsync(x => x.id === (seeded as any).id);
        expect(a.version).toBe(1);
        expect(b.version).toBe(1);

        // A wins the race
        a.balance = 900;
        await writerA.saveChangesAsync();

        // B's write is computed from a stale read — it must FAIL, not clobber
        b.balance = 1100;
        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);

        // A's write survived
        const fresh: any = await writerA.accounts.firstAsync(x => x.id === (seeded as any).id);
        expect(fresh.balance).toBe(900);
        expect(fresh.version).toBe(2);
    });

    it('the loser retries from a fresh read and succeeds', async () => {
        const db = database();
        const writerA = track(new Store(new MemoryPlugin(db)));
        const writerB = track(new Store(new MemoryPlugin(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = a.balance - 100; // A: -100
        await writerA.saveChangesAsync();

        b.balance = b.balance - 250; // B: -250, from a stale base — rejected
        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);

        // Retry: re-read (merges fresh values into the canonical), reapply the INTENT
        const retried: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(retried.version).toBe(2);
        retried.balance = retried.balance - 250;
        await writerB.saveChangesAsync();

        const final: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(final.balance).toBe(650); // both writes landed: 1000 - 100 - 250
        expect(final.version).toBe(3);
    });

    it('names the conflicted rows on the error', async () => {
        const db = database();
        const writerA = track(new Store(new MemoryPlugin(db)));
        const writerB = track(new Store(new MemoryPlugin(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = 1;
        await writerA.saveChangesAsync();
        b.balance = 2;

        const error = await writerB.saveChangesAsync().then(() => null, e => e);

        expect(OptimisticConcurrencyError.is(error)).toBe(true);
        expect(error.collectionName).toBe('occ_accounts');
        expect(error.conflicts).toEqual([id]);
    });
});

describe('conflict detection (diff mode)', () => {
    it('a stale snapshot-tracked write is rejected too', async () => {
        const db = database();
        const writerA = track(new DiffStore(new MemoryPlugin(db)));
        const writerB = track(new DiffStore(new MemoryPlugin(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = 900;
        await writerA.saveChangesAsync();

        b.balance = 1100;
        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);
    });
});

describe('unaffected paths', () => {
    it('a schema without a token keeps last-writer-wins (no behavior change)', async () => {
        const plain = s.define('occ_plain', {
            id: s.string().key().identity(),
            balance: s.number(),
        }).compile();

        class PlainStore extends DataStore {
            accounts = this.collection(plain).proxy().create();
        }

        const db = database();
        const writerA = track(new PlainStore(new MemoryPlugin(db)));
        const writerB = track(new PlainStore(new MemoryPlugin(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = 900;
        await writerA.saveChangesAsync();
        b.balance = 1100;
        await expect(writerB.saveChangesAsync()).resolves.toBeDefined();
    });
});
