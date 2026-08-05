import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PouchDbPlugin } from '../PouchDbPlugin';

/**
 * State scoping: two plugins, two databases, no shared anything.
 *
 * The plugin used to keep its work queue, its index cache and its sync handle at MODULE
 * level, so every instance in a process shared one database's state whatever its name. The
 * sync handle was the worst of the three — stored under the literal key `"sync"`, so only the
 * first plugin in a process could ever establish replication and every later one silently
 * received the first one's handle, pointed at a different remote.
 *
 * None of that shows up in a single-store test, which is why it survived a 119-case suite.
 */

// The `_rev` identity and the `documentType` scope follow the shape every other suite in
// this package uses: PouchDB assigns `_rev` on write, and one database holds every
// collection, so a collection has to filter itself out of it.
const schema = s.define('isolation_rows', {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    label: s.string(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

class Store extends DataStore {
    rows = this.collection(schema)
        .scope(([x, p]) => x.documentType === p.collectionName, { ...schema })
        .proxy()
        .create();
}

const stores: Store[] = [];

const open = (name: string) => {
    const store = new Store(new PouchDbPlugin(name));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('PouchDB instance isolation', () => {
    it('keeps two databases separate', async () => {
        const a = open(`iso-a-${uuidv4()}`);
        const b = open(`iso-b-${uuidv4()}`);

        await a.rows.addAsync({ label: 'in-a' } as any);
        await a.saveChangesAsync();

        expect(await a.rows.countAsync()).toBe(1);
        expect(await b.rows.countAsync()).toBe(0);
    });

    it('does not serve one database\'s index cache to another', async () => {
        // The index cache held a design document under a key that named nothing, so the
        // first database to build one answered for every database afterwards. Both stores
        // run a filtered query, which is what builds and consults it.
        const a = open(`iso-idx-a-${uuidv4()}`);
        const b = open(`iso-idx-b-${uuidv4()}`);

        await a.rows.addAsync({ label: 'alpha' } as any);
        await a.saveChangesAsync();
        expect((await a.rows.where(r => r.label === 'alpha').toArrayAsync()).length).toBe(1);

        await b.rows.addAsync({ label: 'beta' } as any);
        await b.saveChangesAsync();

        expect((await b.rows.where(r => r.label === 'beta').toArrayAsync()).length).toBe(1);
        expect((await b.rows.where(r => r.label === 'alpha').toArrayAsync()).length).toBe(0);
    });

    it('interleaves work across two databases without one blocking the other', async () => {
        // One shared queue serialized every plugin in the process. Both saves must complete;
        // a queue that is still shared deadlocks or serializes them behind each other.
        const a = open(`iso-q-a-${uuidv4()}`);
        const b = open(`iso-q-b-${uuidv4()}`);

        await Promise.all([
            a.rows.addAsync({ label: 'a' } as any).then(() => a.saveChangesAsync()),
            b.rows.addAsync({ label: 'b' } as any).then(() => b.saveChangesAsync()),
        ]);

        expect(await a.rows.countAsync()).toBe(1);
        expect(await b.rows.countAsync()).toBe(1);
    });

    it('leaves the other database intact when one is destroyed', async () => {
        const a = open(`iso-d-a-${uuidv4()}`);
        const b = open(`iso-d-b-${uuidv4()}`);

        await a.rows.addAsync({ label: 'a' } as any);
        await a.saveChangesAsync();
        await b.rows.addAsync({ label: 'b' } as any);
        await b.saveChangesAsync();

        await a.destroyAsync();

        expect(await b.rows.countAsync()).toBe(1);
    });
});

describe('PouchDB work callbacks', () => {
    it('completes a destroy exactly once', async () => {
        // `_doWork` ran both branches when closing was requested: `done` fired synchronously
        // AND again from the close callback. A doubled callback settles an already-settled
        // promise silently, but drives every pipeline stage downstream a second time.
        const store = open(`once-${uuidv4()}`);

        await store.rows.addAsync({ label: 'x' } as any);
        await store.saveChangesAsync();

        // destroyAsync now runs with shouldClose true, the path that used to double-call.
        await expect(store.destroyAsync()).resolves.not.toThrow();
    });

    it('can destroy a database that was never written to', async () => {
        await expect(open(`empty-${uuidv4()}`).destroyAsync()).resolves.not.toThrow();
    });

    it('adds each document exactly once', async () => {
        // `ids` was seeded from every response entry and then had each ok id pushed again,
        // so the follow-up bulk-get asked for every document twice.
        const store = open(`dupe-${uuidv4()}`);

        const added = await store.rows.addAsync(
            { label: 'one' } as any,
            { label: 'two' } as any,
            { label: 'three' } as any,
        );
        await store.saveChangesAsync();

        expect(added).toHaveLength(3);

        const all = await store.rows.toArrayAsync();
        const ids = all.map(r => r._id);

        expect(all).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
    });
});
