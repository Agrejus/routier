import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { DataStore } from '../DataStore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { CacheDbPlugin, ConcurrencyDbPlugin } from '@routier/core/plugins';

/**
 * Optimistic concurrency survives being stacked with a cache, in either order.
 *
 * `specs/plugin-roadmap.md` recorded this as an open hazard: a cache hit never reaches
 * `ConcurrencyDbPlugin`, so the version observer misses the read and the next update is written
 * UNCHECKED — silently, for exactly the rows a cache makes fast.
 *
 * It does not happen, and the reason is structural rather than lucky: wrappers nest, so a cache
 * HIT is always preceded by a MISS through the same chain, and that miss is what observes the
 * version. These tests exist because that argument is easy to believe and easy to break — a
 * cache that pre-warmed, or an observer keyed per query rather than per row, would make it false
 * without changing a line of either file.
 *
 * The assertion is on `update.concurrency`, which is what a backend reads to decide whether to
 * apply the write conditionally. Absent means unconditional.
 */

const schema = s.define('stacking_rows', {
    id: s.string().key(),
    balance: s.number(),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

/**
 * Every update that reached the backend, and whether it carried a concurrency check.
 *
 * Typed structurally rather than as `IDbPlugin`: this only needs to wrap one method, and naming
 * the interface drags in a generic-parameter variance mismatch that has nothing to do with what
 * is being asserted.
 */
const recordUpdates = (plugin: { bulkPersist: (event: any, done: any) => void }) => {
    const seen: (undefined | { column: string; expected: number })[] = [];
    const inner = plugin.bulkPersist.bind(plugin);

    plugin.bulkPersist = (event: any, done: any) => {
        for (const [, changes] of event.operation) {
            for (const update of changes.updates) seen.push(update.concurrency);
        }
        return inner(event, done);
    };

    return seen;
};

const seeded = async (store: Store) => {
    await store.rows.addAsync({ id: '1', balance: 100 });
    await store.saveChangesAsync();
};

describe('wrapper stacking: cache and optimistic concurrency', () => {

    it('checks the write when the read came from the cache, cache outermost', async () => {
        const memory = new MemoryPlugin(`stacking-${Math.random()}`);
        const updates = recordUpdates(memory);
        const store = new Store(new CacheDbPlugin(new ConcurrencyDbPlugin(memory)));

        await seeded(store);

        await store.rows.where(x => x.id === '1').toArrayAsync();            // miss: observes
        const [row] = await store.rows.where(x => x.id === '1').toArrayAsync(); // hit

        row.balance = 50;
        await store.saveChangesAsync();

        expect(updates).toEqual([{ column: '__version', expected: 1 }]);
    });

    it('checks the write when the read came from the cache, concurrency outermost', async () => {
        const memory = new MemoryPlugin(`stacking-${Math.random()}`);
        const updates = recordUpdates(memory);
        const store = new Store(new ConcurrencyDbPlugin(new CacheDbPlugin(memory)));

        await seeded(store);

        await store.rows.where(x => x.id === '1').toArrayAsync();
        const [row] = await store.rows.where(x => x.id === '1').toArrayAsync();

        row.balance = 50;
        await store.saveChangesAsync();

        // The other order the roadmap warned about: the observer strips `__version` in place,
        // but `CacheDbPlugin.rebuild` hands out a structuredClone, so the strip lands on the
        // copy and the cached row keeps its token.
        expect(updates).toEqual([{ column: '__version', expected: 1 }]);
    });

    it('checks the write for a second store sharing one warm chain', async () => {
        const memory = new MemoryPlugin(`stacking-${Math.random()}`);
        const updates = recordUpdates(memory);
        const shared = new CacheDbPlugin(new ConcurrencyDbPlugin(memory));

        const first = new Store(shared);
        await seeded(first);
        await first.rows.where(x => x.id === '1').toArrayAsync();

        const second = new Store(shared);
        const [row] = await second.rows.where(x => x.id === '1').toArrayAsync();

        row.balance = 25;
        await second.saveChangesAsync();

        expect(updates).toEqual([{ column: '__version', expected: 1 }]);
    });

    it('still rejects a conflicting write through the stack', async () => {
        // The check has to do more than be present. Two stores over one database, both reading
        // at version 1: the second write must be refused rather than silently overwrite.
        const name = `stacking-${Math.random()}`;
        const a = new Store(new CacheDbPlugin(new ConcurrencyDbPlugin(new MemoryPlugin(name))));
        const b = new Store(new CacheDbPlugin(new ConcurrencyDbPlugin(new MemoryPlugin(name))));

        await seeded(a);

        const [rowA] = await a.rows.where(x => x.id === '1').toArrayAsync();
        const [rowB] = await b.rows.where(x => x.id === '1').toArrayAsync();

        rowA.balance = 50;
        await a.saveChangesAsync();

        rowB.balance = 75;

        await expect(b.saveChangesAsync()).rejects.toThrow();
    });
});
