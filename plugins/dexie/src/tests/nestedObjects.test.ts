import { describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../index';

/**
 * Nested objects, which Dexie stores whole and never indexes into.
 *
 * `convertToDexieSchema` used to emit the children of a nested object into the stores string
 * as though they were top-level properties, because a root property is level 0 and its
 * children are level 1, and the guard skipped only `level > 1`.
 *
 * Two nested objects sharing a child name is the case that turns that from waste into
 * failure: `original.size` and `thumbnail.size` both emitted `size`, IndexedDB refused the
 * duplicate index, and the database failed to OPEN with `ConstraintError` — every operation
 * on the store, not just an indexed query. A file and its thumbnail is exactly this shape.
 */
const schema = s.define('assets', {
    id: s.string().key().identity(),
    original: s.object({ key: s.string(), size: s.number() }),
    thumbnail: s.object({ key: s.string(), size: s.number() }),
}).compile();

class Store extends DataStore {
    assets = this.collection(schema).proxy().create();
    constructor(name: string) { super(new DexiePlugin(name)); }
}

describe('nested objects in a Dexie schema', () => {
    it('opens and round-trips when two of them share a child name', async () => {
        const store = new Store(`collide-${uuidv4()}`);

        await store.assets.addAsync({
            original: { key: 'a', size: 100 },
            thumbnail: { key: 'b', size: 10 },
        } as never);
        await store.saveChangesAsync();

        const all = await store.assets.toArrayAsync();
        expect(all).toHaveLength(1);
        expect((all[0] as any).original.size).toBe(100);
        expect((all[0] as any).thumbnail.size).toBe(10);

        await store.destroyAsync();
    });
});

describe('the stores string', () => {
    it('names root properties only', () => {
        // Imported here so the test reads as a statement about the derivation itself.
        const { convertToDexieSchema } = require('../utils');

        const stores = convertToDexieSchema(schema as never);

        expect(stores).toContain('original');
        expect(stores).toContain('thumbnail');
        // `key` and `size` live inside those objects and are not paths on the record.
        expect(stores.split(',')).not.toContain('key');
        expect(stores.split(',')).not.toContain('size');
    });
});
