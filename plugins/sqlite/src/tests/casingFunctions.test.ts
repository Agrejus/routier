import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import type { SqliteConnection, SqliteDriver } from '../drivers/types';

const schema = s.define('casing_rows', { id: s.string().key(), name: s.string().nullable() }).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const dirs: string[] = [];

const databaseFile = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-casing-'));
    dirs.push(dir);
    return path.join(dir, `${uuidv4()}.sqlite`);
};

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const seeded = async () => {
    const store = new Store(new SqliteDbPlugin(databaseFile()));
    await store.rows.addAsync({ id: 'a', name: 'École' }, { id: 'b', name: null }, { id: 'c', name: 'école' });
    await store.saveChangesAsync();
    return store;
};

describe('the casing functions SQLite runs for node:sqlite', () => {
    it('lowercases beyond ASCII', async () => {
        const store = await seeded();

        expect((await store.rows.where(row => row.name!.toLowerCase() === 'école').sort(row => row.id).toArrayAsync()).map(row => row.id)).toEqual(['a', 'c']);
    });

    it('uppercases beyond ASCII', async () => {
        const store = await seeded();

        expect((await store.rows.where(row => row.name!.toUpperCase() === 'ÉCOLE').sort(row => row.id).toArrayAsync()).map(row => row.id)).toEqual(['a', 'c']);
    });

    it('passes a null through instead of failing the query', async () => {
        const store = await seeded();

        await expect(store.rows.where(row => row.name!.toLowerCase() === 'x').toArrayAsync()).resolves.toEqual([]);
        await expect(store.rows.where(row => row.name!.toUpperCase() === 'X').toArrayAsync()).resolves.toEqual([]);
    });
});

describe('when the casing functions are registered', () => {
    const registered = async (driver: Partial<SqliteDriver>, withDefineFunction: boolean) => {
        const names: string[] = [];
        const base = nodeSqliteDriver();
        const store = new Store(new SqliteDbPlugin(databaseFile(), {
            driver: {
                ...base,
                ...driver,
                async open(name: string): Promise<SqliteConnection> {
                    const connection = await base.open(name);

                    return {
                        all: (sql, params, result) => connection.all(sql, params, result),
                        run: (sql, params) => connection.run(sql, params),
                        close: () => connection.close(),
                        ...(withDefineFunction ? { defineFunction: (fn: string) => { names.push(fn); } } : {}),
                    };
                },
            },
        }));

        await store.rows.countAsync();
        return names;
    };

    it('registers lower and upper for a driver that folds Unicode casing', async () => {
        expect(await registered({ foldsUnicodeCasing: true }, true)).toEqual(['lower', 'upper']);
    });

    it('registers nothing for a driver that does not fold Unicode casing', async () => {
        expect(await registered({ foldsUnicodeCasing: false }, true)).toEqual([]);
    });

    it('opens a connection that cannot define functions without failing', async () => {
        await expect(registered({ foldsUnicodeCasing: true }, false)).resolves.toEqual([]);
    });
});
