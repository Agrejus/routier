import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { CacheDbPlugin, ConcurrencyDbPlugin, RetryDbPlugin } from '@routier/core/plugins';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const schema = s.define('scoping_scratch', {
    _id: s.string().key().identity(),
    name: s.string(),
}).compile();

class Store extends DataStore {
    products = this.collection(schema).proxy().create();
}

const stores: DataStore[] = [];
afterEach(() => { for (const st of stores.splice(0)) st[Symbol.dispose](); });

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const track = <T extends DataStore>(store: T) => { stores.push(store); return store; };

/**
 * Subscription channels are keyed by schema AND `IDbPlugin.databaseName`. Before that member
 * was required, a plugin that declared nothing fell back to a key of the schema alone — so
 * every store holding that schema shared one channel no matter which database it pointed at.
 * SQLite, PostgreSQL, MySQL, Dexie and PouchDB all declared nothing, which meant the fallback
 * was the normal case rather than the exception.
 */
describe('subscription channels are scoped by database', () => {

    it('does not notify a store over a DIFFERENT database', async () => {
        const a = track(new Store(new MemoryPlugin('scope-db-a')));
        const b = track(new Store(new MemoryPlugin('scope-db-b')));

        const deliveries: unknown[][] = [];
        b.products.subscribe().toArray(r => { if (r.ok !== 'error') deliveries.push(r.data); });

        await wait(150);
        const before = deliveries.length;

        await a.products.addAsync({ name: 'written to a' } as any);
        await a.saveChangesAsync();
        await wait(300);

        // b's own database never changed, so nothing new should have arrived for it.
        expect(deliveries.length).toBe(before);
        expect(await b.products.countAsync()).toBe(0);
    });

    it('DOES notify another instance of the SAME database', async () => {
        // Two plugin instances, one database name — the two-tab case, modelled in process.
        const a = track(new Store(new MemoryPlugin('scope-db-shared')));
        const b = track(new Store(new MemoryPlugin('scope-db-shared')));

        const deliveries: unknown[][] = [];
        b.products.subscribe().toArray(r => { if (r.ok !== 'error') deliveries.push(r.data); });

        await wait(150);
        const before = deliveries.length;

        await a.products.addAsync({ name: 'written to the shared db' } as any);
        await a.saveChangesAsync();
        await wait(300);

        // Keying by plugin INSTANCE would pass the previous test and fail this one.
        expect(deliveries.length).toBeGreaterThan(before);
    });
});

/**
 * A wrapper that dropped the name would silently rejoin the shared key. The type system only
 * catches a wrapper that omits the member entirely, not one that answers with something of
 * its own, so the forwarding is asserted rather than assumed.
 */
describe('wrappers preserve the database name', () => {

    it.each([
        ['retry', (inner: MemoryPlugin) => new RetryDbPlugin(inner)],
        ['cache', (inner: MemoryPlugin) => new CacheDbPlugin(inner)],
        ['concurrency', (inner: MemoryPlugin) => new ConcurrencyDbPlugin(inner)],
    ])('%s reports the inner plugin\'s name', (_label, wrap) => {
        const inner = new MemoryPlugin('scope-db-wrapped');

        expect(wrap(inner).databaseName).toBe('scope-db-wrapped');
    });
});
