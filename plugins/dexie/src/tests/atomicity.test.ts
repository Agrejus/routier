import { afterEach, describe, expect, it } from '@jest/globals';
import Dexie from 'dexie';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { DexiePlugin } from '../DexiePlugin';

/**
 * Atomicity across collections, and the schema-version contract.
 *
 * A save spanning two collections used to be two independent IndexedDB transactions awaited
 * together, so the first could commit while the second failed. `saveChanges` reported the
 * failure, but the database had already taken half of it — which contradicts the datastore's
 * own all-or-nothing contract, and is the kind of divergence that only shows up as
 * inconsistent data days later.
 */

const alphaSchema = s.define('atomicity_alpha', {
    id: s.string().key(),
    value: s.string(),
}).compile();

const betaSchema = s.define('atomicity_beta', {
    id: s.string().key(),
    value: s.string(),
}).compile();

class TwoCollectionStore extends DataStore {
    alpha = this.collection(alphaSchema).proxy().create();
    beta = this.collection(betaSchema).proxy().create();
}

const stores: DataStore[] = [];

const open = (name: string, version?: number) => {
    const store = new TwoCollectionStore(new DexiePlugin(name, version == null ? undefined : { version }));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('Dexie writes one transaction per save', () => {
    it('persists writes to two collections in a single save', async () => {
        const name = `atomic-ok-${uuidv4()}-db`;
        const store = open(name);

        await store.alpha.addAsync({ id: 'a', value: 'one' } as any);
        await store.beta.addAsync({ id: 'b', value: 'two' } as any);
        await store.saveChangesAsync();

        const reader = open(name);
        expect(await reader.alpha.countAsync()).toBe(1);
        expect(await reader.beta.countAsync()).toBe(1);
    });

    it('rolls the first collection back when the second collection fails', async () => {
        // The second collection's add collides with a key already present, which fails the
        // transaction after the first collection's write has been issued. Under the old
        // `Promise.all` shape that first write was already committed in its own transaction.
        const name = `atomic-rollback-${uuidv4()}-db`;

        const seed = open(name);
        await seed.beta.addAsync({ id: 'collides', value: 'original' } as any);
        await seed.saveChangesAsync();

        const writer = open(name);
        await writer.alpha.addAsync({ id: 'should-not-survive', value: 'x' } as any);
        await writer.beta.addAsync({ id: 'collides', value: 'duplicate' } as any);

        const outcome = await writer.saveChangesAsync().then(() => 'resolved', e => e);
        expect(outcome).not.toBe('resolved');

        const reader = open(name);

        // The whole save is undone: alpha's row is absent and beta's original is untouched.
        expect(await reader.alpha.countAsync()).toBe(0);
        expect((await reader.beta.firstAsync(r => r.id === 'collides')).value).toBe('original');
    });

    it('applies removes, updates and adds from one save together', async () => {
        const name = `atomic-mixed-${uuidv4()}-db`;

        const seed = open(name);
        await seed.alpha.addAsync(
            { id: 'keep', value: 'before' } as any,
            { id: 'drop', value: 'gone' } as any,
        );
        await seed.saveChangesAsync();

        const writer = open(name);
        const keep = await writer.alpha.firstAsync(r => r.id === 'keep');
        keep.value = 'after';
        await writer.alpha.removeAsync(await writer.alpha.firstAsync(r => r.id === 'drop'));
        await writer.alpha.addAsync({ id: 'new', value: 'fresh' } as any);
        await writer.saveChangesAsync();

        const rows = await open(name).alpha.toArrayAsync();

        expect(rows.map(r => r.id).sort()).toEqual(['keep', 'new']);
        expect(rows.find(r => r.id === 'keep')!.value).toBe('after');
    });
});

describe('Dexie schema versioning', () => {
    const extendedSchema = s.define('atomicity_alpha', {
        id: s.string().key(),
        value: s.string(),
        // A new index changes the stores spec, which is what Dexie keys to a version.
        indexed: s.string().index('by_indexed'),
    }).compile();

    class ExtendedStore extends DataStore {
        alpha = this.collection(extendedSchema).proxy().create();
    }

    it('defaults to version 1', async () => {
        const name = `version-default-${uuidv4()}-db`;
        const store = open(name);

        await store.alpha.addAsync({ id: 'a', value: 'v' } as any);
        await store.saveChangesAsync();

        const db = new Dexie(name);
        await db.open();
        expect(db.verno).toBe(1);
        db.close();
    });

    it('opens at the version it was given', async () => {
        const name = `version-explicit-${uuidv4()}-db`;
        const store = open(name, 3);

        await store.alpha.addAsync({ id: 'a', value: 'v' } as any);
        await store.saveChangesAsync();

        const db = new Dexie(name);
        await db.open();
        expect(db.verno).toBe(3);
        db.close();
    });

    it('either widens the layout or explains which option to change', async () => {
        const name = `version-conflict-${uuidv4()}-db`;

        const first = open(name);
        await first.alpha.addAsync({ id: 'a', value: 'v' } as any);
        await first.saveChangesAsync();

        // Same version, MORE indexes than the stored database has.
        //
        // Dexie handles this itself where it can: it logs "Schema was extended without
        // increasing the number passed to db.version()" and adds the missing index, bumping
        // the native version. So the additive case succeeds, and this asserts the data is
        // intact rather than asserting a failure that does not happen.
        //
        // The plugin's version message covers what Dexie will NOT absorb — a removed or
        // altered index, where it raises VersionError/SchemaError. That path is asserted by
        // the error mapping itself rather than reproduced here, because provoking it depends
        // on IndexedDB implementation details that differ between fake-indexeddb and a
        // browser, and a test that only holds on the fake is worse than none.
        const second = new ExtendedStore(new DexiePlugin(name));
        stores.push(second);

        await second.alpha.addAsync({ id: 'b', value: 'v', indexed: 'i' } as any);
        const outcome = await second.saveChangesAsync().then(() => null, (e: Error) => e);

        if (outcome == null) {
            expect(await second.alpha.countAsync()).toBe(2);
            return;
        }

        expect(String(outcome.message)).toMatch(/version/i);
    });

    it('accepts the new layout when the version is bumped', async () => {
        const name = `version-bumped-${uuidv4()}-db`;

        const first = open(name);
        await first.alpha.addAsync({ id: 'a', value: 'v' } as any);
        await first.saveChangesAsync();

        const second = new ExtendedStore(new DexiePlugin(name, { version: 2 }));
        stores.push(second);

        await second.alpha.addAsync({ id: 'b', value: 'v', indexed: 'i' } as any);
        await second.saveChangesAsync();

        expect(await second.alpha.countAsync()).toBe(2);
    });

    it('does not serve one schema set\'s stores to a different one', async () => {
        // The cache used to be validated by entry COUNT, so two different schema sets of the
        // same size returned the first one's stores.
        const nameA = `cache-a-${uuidv4()}-db`;
        const nameB = `cache-b-${uuidv4()}-db`;

        const a = new ExtendedStore(new DexiePlugin(nameA));
        stores.push(a);
        await a.alpha.addAsync({ id: 'a', value: 'v', indexed: 'i' } as any);
        await a.saveChangesAsync();

        const b = open(nameB);
        await b.alpha.addAsync({ id: 'b', value: 'v' } as any);
        await b.saveChangesAsync();

        expect(await b.alpha.countAsync()).toBe(1);
        expect(await a.alpha.countAsync()).toBe(1);
    });
});
