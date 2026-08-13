import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { ConcurrencyDbPlugin, OptimisticConcurrencyError } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * Optimistic concurrency as a wrapper plugin — the feature the finance stress app proved
 * missing, with ZERO schema/builder surface: wrap the storage plugin and every row gets a
 * hidden `__version` token.
 *
 * Two writers read the same row; both write. Without the wrapper the second write silently
 * overwrites the first (the lost update that showed up as invariant drift). With it the
 * second save FAILS with a conflict naming the row, the caller re-reads and retries, and
 * no write is ever silently lost.
 */

const schema = s.define('occ_accounts', {
    id: s.string().key().identity(),
    balance: s.number(),
}).compile();

class Store extends DataStore {
    accounts = this.collection(schema).proxy().create();
}

class DiffStore extends DataStore {
    accounts = this.collection(schema).diff().create();
}

const stores: DataStore[] = [];
const track = <T extends DataStore>(store: T) => { stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store[Symbol.dispose](); });

const database = () => `occ-${Math.random()}`;
const guarded = (db: string) => new ConcurrencyDbPlugin(new MemoryPlugin(db));

describe('invisibility', () => {
    it('entities never carry the hidden token', async () => {
        const store = track(new Store(guarded(database())));

        const [added]: any[] = await store.accounts.addAsync({ balance: 100 } as any);
        await store.saveChangesAsync();

        expect(added.__version).toBeUndefined();

        const [read]: any[] = await store.accounts.toArrayAsync();
        expect(read.__version).toBeUndefined();
        expect(Object.keys(read).sort()).toEqual(['balance', 'id']);
    });
});

describe('conflict detection (proxy mode)', () => {
    it('rejects the second writer and preserves the first write', async () => {
        const db = database();
        const writerA = track(new Store(guarded(db)));
        const writerB = track(new Store(guarded(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        // Both writers read the row
        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        // A wins the race
        a.balance = 900;
        await writerA.saveChangesAsync();

        // B's write is computed from a stale read — it must FAIL, not clobber
        b.balance = 1100;
        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);

        // A's write survived
        const fresh: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(fresh.balance).toBe(900);
    });

    it('the loser retries from a fresh read and succeeds', async () => {
        const db = database();
        const writerA = track(new Store(guarded(db)));
        const writerB = track(new Store(guarded(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = a.balance - 100; // A: -100
        await writerA.saveChangesAsync();

        b.balance = b.balance - 250; // B: -250, from a stale base — rejected
        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);

        // Retry: re-read (re-arms the observation), reapply the INTENT
        const retried: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        retried.balance = retried.balance - 250;
        await writerB.saveChangesAsync();

        const final: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(final.balance).toBe(650); // both writes landed: 1000 - 100 - 250
    });

    it('names the conflicted rows on the error', async () => {
        const db = database();
        const writerA = track(new Store(guarded(db)));
        const writerB = track(new Store(guarded(db)));

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
        const writerA = track(new DiffStore(guarded(db)));
        const writerB = track(new DiffStore(guarded(db)));

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
    it('an unwrapped plugin keeps last-writer-wins (no behavior change)', async () => {
        const db = database();
        const writerA = track(new Store(new MemoryPlugin(db)));
        const writerB = track(new Store(new MemoryPlugin(db)));

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

describe('cross-collection atomicity', () => {
    // The finance-app shape that exposed the gap: one save carries a LEDGER ADD and a
    // conflicting ACCOUNT UPDATE. Per-collection persistence committed the ledger row
    // before the account collection rejected — one orphan ledger row per conflict.
    const ledgerSchema = s.define('occ_ledger', {
        id: s.string().key().identity(),
        amount: s.number(),
    }).compile();

    class BankStore extends DataStore {
        accounts = this.collection(schema).diff().create();
        ledger = this.collection(ledgerSchema).immutable().create();
    }

    it('a conflicted save applies NOTHING in any collection', async () => {
        const db = database();
        const writerA = track(new BankStore(guarded(db)));
        const writerB = track(new BankStore(guarded(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = 900;
        await writerA.saveChangesAsync();

        // B's save carries BOTH a ledger add and the (stale) balance update
        await writerB.ledger.addAsync({ amount: 100 } as any);
        b.balance = 1100;

        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);

        // Nothing from the failed save may exist: no orphan ledger row, no balance change
        expect(await writerA.ledger.countAsync()).toBe(0);
        const fresh: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(fresh.balance).toBe(900);
    });

    it('a retried transaction lands exactly once in every collection', async () => {
        const db = database();
        const writerA = track(new BankStore(guarded(db)));
        const writerB = track(new BankStore(guarded(db)));

        const [seeded]: any[] = await writerA.accounts.addAsync({ balance: 1000 } as any);
        await writerA.saveChangesAsync();
        const id = (seeded as any).id;

        const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

        a.balance = 900;
        await writerA.saveChangesAsync();

        // First attempt conflicts...
        await writerB.ledger.addAsync({ amount: 100 } as any);
        b.balance = 1100;
        await expect(writerB.saveChangesAsync()).rejects.toThrow(OptimisticConcurrencyError);

        // ...and because the save applied NOTHING, the pending intent SURVIVES in the
        // tracker — the ledger add is still queued. The retry refreshes only the stale
        // account and re-saves; re-adding the ledger row would double it.
        expect(writerB.ledger.hasChanges()).toBe(true);

        writerB.accounts.attachments.remove(b);
        const retried: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        retried.balance = retried.balance + 100;
        await writerB.saveChangesAsync();

        // Exactly one ledger row, and the balance reflects both writers
        expect(await writerA.ledger.countAsync()).toBe(1);
        const final: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
        expect(final.balance).toBe(1000);
    });
});
