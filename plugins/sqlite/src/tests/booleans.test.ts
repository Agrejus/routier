import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

/**
 * Booleans against SQLite, which has no boolean type.
 *
 * That is the engine's limitation and therefore the plugin's problem, not the caller's: a
 * schema saying `s.boolean()` should not also have to say how to store one. The dialect
 * converts to 1 and 0 on the way in and back on the way out.
 *
 * Both halves are needed and each fails differently. Without the encode, `node:sqlite` refuses
 * to bind a JS boolean at all and every save throws. Without the decode, the row comes back as
 * `1` — truthy, but not `true` — so `compare` reports the entity as changed against its own
 * echo and the change tracker cannot match the addition it just sent.
 */

const schema = s.define('boolean_flags', {
    id: s.string().key().identity(),
    name: s.string(),
    active: s.boolean(),
}).compile();

class Store extends DataStore {
    flags = this.collection(schema).proxy().create();
}

const stores: DataStore[] = [];

const open = () => {
    const store = new Store(new SqliteDbPlugin(`booleans-${uuidv4()}.sqlite`));
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('booleans on SQLite', () => {

    it('round-trips true and false', async () => {
        const store = open();

        await store.flags.addAsync(
            { name: 'on', active: true } as any,
            { name: 'off', active: false } as any,
        );
        await store.saveChangesAsync();

        const rows = await store.flags.toArrayAsync();

        // `false`, not `0`. A truthiness check would pass on 0 and still be wrong.
        expect(rows.find(r => r.name === 'on')!.active).toBe(true);
        expect(rows.find(r => r.name === 'off')!.active).toBe(false);
    });

    it('filters on a boolean', async () => {
        const store = open();

        await store.flags.addAsync(
            { name: 'on', active: true } as any,
            { name: 'off', active: false } as any,
        );
        await store.saveChangesAsync();

        expect((await store.flags.where(f => f.active === true).toArrayAsync()).map(x => x.name)).toEqual(['on']);
        expect((await store.flags.where(f => f.active === false).toArrayAsync()).map(x => x.name)).toEqual(['off']);
    });

    it('updates a boolean', async () => {
        const store = open();

        const [flag] = await store.flags.addAsync({ name: 'on', active: true } as any);
        await store.saveChangesAsync();

        flag.active = false;
        await store.saveChangesAsync();

        expect((await store.flags.firstAsync(f => f.name === 'on')).active).toBe(false);
    });

    it('reports no changes when nothing changed', async () => {
        const store = open();

        await store.flags.addAsync({ name: 'on', active: true } as any);
        await store.saveChangesAsync();

        // The decode half. A boolean read back as `1` never equals the `true` the entity
        // holds, so every save would rewrite every row forever.
        const result = await store.saveChangesAsync();

        expect(result.aggregate.size).toBe(0);
    });
});
