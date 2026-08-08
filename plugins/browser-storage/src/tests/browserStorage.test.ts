import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { describePluginContract, describeVectorSearch } from '@routier/test-utils';
import { BrowserStoragePlugin } from '../BrowserStoragePlugin';

/**
 * Coverage for the browser-storage plugin, which previously had none.
 *
 * The plugin takes a `Storage` rather than reaching for a global, so it is tested against an
 * in-memory implementation of that interface instead of jsdom. That keeps the suite free of
 * a DOM environment and, more usefully, makes the storage observable: the tests can inspect
 * exactly what was written and simulate a page reload by handing the same Storage to a new
 * plugin instance.
 */

/** A Map-backed `Storage`, matching the subset of the DOM interface the plugin uses. */
class FakeStorage implements Storage {
    private readonly entries = new Map<string, string>();

    get length() {
        return this.entries.size;
    }

    clear(): void {
        this.entries.clear();
    }

    getItem(key: string): string | null {
        // The DOM contract is null for a missing key, not undefined — a plugin branching on
        // `=== null` would misbehave against a fake that returned undefined.
        return this.entries.has(key) ? this.entries.get(key)! : null;
    }

    key(index: number): string | null {
        return Array.from(this.entries.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.entries.delete(key);
    }

    setItem(key: string, value: string): void {
        this.entries.set(key, String(value));
    }

    /** Test-only: the raw keys currently held. */
    keys(): string[] {
        return Array.from(this.entries.keys());
    }
}

describeVectorSearch(
    'browser-storage',
    () => new BrowserStoragePlugin(`vector-${uuidv4()}`, new FakeStorage()),
);

describePluginContract(
    'browser-storage',
    () => new BrowserStoragePlugin(`contract-${uuidv4()}`, new FakeStorage()),
    { supportsRichTypes: true },
);

const schema = s.define('bs_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(schema).proxy().create();
}

describe('browser-storage persistence', () => {
    /**
     * Opened stores, disposed after every test. A DataStore opens a BroadcastChannel pair
     * per collection at construction — two MessagePort handles that hold the Node event
     * loop open whether or not anything ever subscribes. This file was the last one in the
     * repository leaking them, and a leak here is what a `--forceExit` covers up.
     */
    const stores: ProductStore[] = [];

    const open = (dbName: string, storage: Storage) => {
        const store = new ProductStore(new BrowserStoragePlugin(dbName, storage));
        stores.push(store);
        return store;
    };

    afterEach(() => {
        for (const store of stores.splice(0)) {
            store[Symbol.dispose]();
        }
    });

    it('writes entries into the supplied storage', async () => {
        const storage = new FakeStorage();
        const store = open('db-write', storage);

        await store.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await store.saveChangesAsync();

        expect(storage.length).toBeGreaterThan(0);
    });

    it('reads back through a new plugin over the same storage', async () => {
        const storage = new FakeStorage();
        const first = open('db-reload', storage);
        await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        // A second plugin instance over the same Storage is what a page reload looks like:
        // no shared in-memory state, only what was serialized.
        expect(await open('db-reload', storage).products.countAsync()).toBe(1);
    });

    it('preserves values across a reload, not just the count', async () => {
        const storage = new FakeStorage();
        const first = open('db-values', storage);
        await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        const reloaded = await open('db-values', storage).products.firstAsync(p => p.name === 'Alpha');

        expect(reloaded.price).toBe(10);
    });

    it('preserves generated identities across a reload', async () => {
        const storage = new FakeStorage();
        const first = open('db-ids', storage);
        const [added] = await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        const reloaded = await open('db-ids', storage).products.firstAsync(p => p.name === 'Alpha');

        expect(reloaded._id).toBe(added._id);
    });

    it('keeps two databases in one storage separate', async () => {
        // localStorage is a single flat namespace shared by the whole origin, so the plugin
        // has to partition by database name. Without that, two stores silently merge.
        const storage = new FakeStorage();
        const one = open('db-a', storage);
        await one.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await one.saveChangesAsync();

        expect(await open('db-b', storage).products.countAsync()).toBe(0);
        expect(await open('db-a', storage).products.countAsync()).toBe(1);
    });

    it('namespaces its storage keys by database name', async () => {
        const storage = new FakeStorage();
        const store = open('db-namespaced', storage);
        await store.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await store.saveChangesAsync();

        expect(storage.keys().some(key => key.includes('db-namespaced'))).toBe(true);
    });

    it('reports an empty collection for storage that holds nothing', async () => {
        expect(await open('db-empty', new FakeStorage()).products.countAsync()).toBe(0);
    });

    it('persists a removal across a reload', async () => {
        const storage = new FakeStorage();
        const first = open('db-remove', storage);
        await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        const second = open('db-remove', storage);
        await second.products.removeAsync(await second.products.firstAsync(p => p.name === 'Alpha'));
        await second.saveChangesAsync();

        expect(await open('db-remove', storage).products.countAsync()).toBe(0);
    });

    it('persists an update across a reload', async () => {
        const storage = new FakeStorage();
        const first = open('db-update', storage);
        await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        const second = open('db-update', storage);
        const found = await second.products.firstAsync(p => p.name === 'Alpha');
        found.price = 99;
        await second.saveChangesAsync();

        expect((await open('db-update', storage).products.firstAsync(p => p.name === 'Alpha')).price).toBe(99);
    });

    // An add-only batch is the one shape that skips load() (EphemeralDataPlugin only
    // hydrates when a batch has updates or removes), so a fresh plugin instance starts from
    // an empty collection and then serializes that empty view over the whole storage value.
    // Nothing errors: the add succeeds and the rows that were already there are gone.
    it('keeps existing rows when a fresh instance performs an add-only save', async () => {
        const storage = new FakeStorage();

        const first = open('db-add-only', storage);
        await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        // A new plugin over the same storage — a page reload — that only ADDS.
        const second = open('db-add-only', storage);
        await second.products.addAsync({ name: 'Beta', price: 20 } as any);
        await second.saveChangesAsync();

        const names = (await open('db-add-only', storage).products.toArrayAsync())
            .map(p => p.name)
            .sort();

        expect(names).toEqual(['Alpha', 'Beta']);
    });

    it('shares one collection view across plugin instances over the same storage', async () => {
        // Two stores, no reload between them: both must resolve to the SAME in-memory
        // collection, or each is an independent read-modify-write owner of one key.
        const storage = new FakeStorage();

        const a = open('db-shared', storage);
        const b = open('db-shared', storage);

        await a.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await a.saveChangesAsync();
        await b.products.addAsync({ name: 'Beta', price: 20 } as any);
        await b.saveChangesAsync();

        expect(await open('db-shared', storage).products.countAsync()).toBe(2);
    });

    it('keeps the same database name in two different Storage objects separate', async () => {
        const local = new FakeStorage();
        const session = new FakeStorage();

        const first = open('db-two-storages', local);
        await first.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await first.saveChangesAsync();

        expect(await open('db-two-storages', session).products.countAsync()).toBe(0);
    });

    it('treats an empty stored value as an empty collection', async () => {
        const storage = new FakeStorage();
        storage.setItem('db-blank__bs_products', '');

        expect(await open('db-blank', storage).products.countAsync()).toBe(0);
    });

    it('fails loudly on an unparseable value instead of discarding it', async () => {
        const storage = new FakeStorage();
        storage.setItem('db-corrupt__bs_products', '{not json');

        const error = await open('db-corrupt', storage).products.toArrayAsync().then(() => null, e => e);

        expect(error).not.toBeNull();
        // The message has to name the key: the user's only recovery is to go and look at it.
        expect(String(error.message)).toContain('db-corrupt__bs_products');
    });

    it('leaves an unparseable value in place rather than overwriting it', async () => {
        // The dangerous recovery is "reset to empty and carry on" — that converts data the
        // plugin could not read into data the plugin deleted.
        const storage = new FakeStorage();
        storage.setItem('db-corrupt-keep__bs_products', '{not json');

        const store = open('db-corrupt-keep', storage);
        await store.products.addAsync({ name: 'Alpha', price: 10 } as any).catch(() => undefined);
        await store.saveChangesAsync().catch(() => undefined);

        expect(storage.getItem('db-corrupt-keep__bs_products')).toBe('{not json');
    });

    it('stores values as strings, as the Storage contract requires', async () => {
        const storage = new FakeStorage();
        const store = open('db-strings', storage);
        await store.products.addAsync({ name: 'Alpha', price: 10 } as any);
        await store.saveChangesAsync();

        for (const key of storage.keys()) {
            expect(typeof storage.getItem(key)).toBe('string');
        }
    });
});
