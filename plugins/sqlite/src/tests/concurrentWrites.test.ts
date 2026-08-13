import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

/**
 * Concurrent writes through one plugin.
 *
 * SQLite has a single write lock per database, and a store writes from more than one place —
 * the caller's save, and every view reconciling in response to it. Overlapping writes used to
 * mean the second got "database is locked" rather than waiting, and for a view that failure was
 * only logged, leaving it silently stale.
 *
 * The plugin serializes its own writes, which is why this is tested here rather than in the
 * datastore: it is a fact about this engine. PostgreSQL and MongoDB take concurrent writes and
 * queueing them would cost real throughput for no gain.
 */

const schema = s.define('concurrent_rows', {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const stores: DataStore[] = [];

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('concurrent writes on SQLite', () => {

    it('applies every write when several stores share one plugin', async () => {
        // One plugin, many stores — the shape a store with views produces, where the caller's
        // save and each view's write reach the same plugin at once.
        const plugin = new SqliteDbPlugin(`concurrent-${uuidv4()}.sqlite`);
        const writers = Array.from({ length: 25 }, () => {
            const store = new Store(plugin);
            stores.push(store);
            return store;
        });

        await Promise.all(writers.map(async (store, i) => {
            await store.rows.addAsync({ name: `row-${i}` } as any);
            await store.saveChangesAsync();
        }));

        // Every one landed. Without serialization this threw "database is locked" instead.
        expect(await writers[0].rows.countAsync()).toBe(25);
    }, 30_000);

    it('keeps writing after one write fails', async () => {
        const plugin = new SqliteDbPlugin(`concurrent-fail-${uuidv4()}.sqlite`);
        const store = new Store(plugin);
        stores.push(store);

        await store.rows.addAsync({ name: 'first' } as any);
        await store.saveChangesAsync();

        // A write that cannot succeed, run through the same queue.
        await expect(new Promise((resolve, reject) => plugin.bulkPersist(
            { id: 'bad', operation: null as never, schemas: null as never, source: 'test', action: 'persist' },
            r => r.ok === 'error' ? reject(r.error) : resolve(r.data)
        ))).rejects.toBeDefined();

        // The queue chains on the previous OUTCOME, not on its success, so a failure must not
        // stall everything behind it.
        await store.rows.addAsync({ name: 'second' } as any);
        await store.saveChangesAsync();

        expect(await store.rows.countAsync()).toBe(2);
    }, 30_000);
});
