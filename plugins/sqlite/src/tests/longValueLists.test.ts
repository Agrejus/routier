import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { D1DbPlugin } from '../d1';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import { sqlite3Driver } from '../drivers/sqlite3';
import type { SqliteDriver } from '../drivers/types';
import { FakeD1Database } from './FakeD1Database';

const items = s.define('long_list_items', {
    id: s.string().key(),
    size: s.number(),
    label: s.string().nullable(),
    active: s.boolean(),
}).compile();

class Store extends DataStore {
    items = this.collection(items).proxy().create();
}

type Item = { id: string; size: number; label: string | null; active: boolean };

const ROWS: Item[] = Array.from({ length: 1200 }, (_, i) => ({
    id: `i${i}`,
    size: i % 7 === 0 ? i + 0.5 : i,
    label: i % 5 === 0 ? null : `label ${i % 40}`,
    active: i % 2 === 0,
}));

const cleanups: (() => void)[] = [];

afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
        cleanup();
    }
});

const seeded = async (store: Store): Promise<Store> => {
    await store.items.addAsync(...ROWS.map(row => ({ ...row })));
    await store.saveChangesAsync();
    return store;
};

const onD1 = async (): Promise<Store> => {
    const database = new FakeD1Database();
    const store = new Store(new D1DbPlugin(database, { deleteDatabase: async () => undefined }));
    cleanups.push(() => { store[Symbol.dispose](); database.close(); });
    return seeded(store);
};

const onFile = (driver: () => SqliteDriver) => async (): Promise<Store> => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-long-lists-'));
    const store = new Store(new SqliteDbPlugin(path.join(dir, 'lists.sqlite'), { driver: driver() }));
    cleanups.push(() => { store[Symbol.dispose](); fs.rmSync(dir, { recursive: true, force: true }); });
    return seeded(store);
};

const idsOf = (rows: readonly Item[]) => rows.map(row => row.id).sort();

const sizes = [3, 7.5, 14.5, 20, 999, 1199, 5000];
const labels = Array.from({ length: 60 }, (_, i) => `label ${i}`);

describe.each([
    ['Cloudflare D1', onD1],
    ['node:sqlite', onFile(nodeSqliteDriver)],
    ['sqlite3', onFile(sqlite3Driver)],
])('long lists of values on %s', (_engine, open) => {
    it.each([1, 100, 101, 250, 1000])('finds rows whose id is in a list of %i ids', async count => {
        const store = await open();
        const ids = Array.from({ length: count }, (_, i) => `i${i * 2}`);

        const found = await store.items.where(([x, p]) => p.ids.includes(x.id), { ids }).toArrayAsync();

        expect(idsOf(found)).toEqual(idsOf(ROWS.filter(row => ids.includes(row.id))));
    });

    it('excludes rows whose id is in a long list', async () => {
        const store = await open();
        const ids = Array.from({ length: 500 }, (_, i) => `i${i}`);

        const found = await store.items.where(([x, p]) => !p.ids.includes(x.id), { ids }).toArrayAsync();

        expect(idsOf(found)).toEqual(idsOf(ROWS.filter(row => !ids.includes(row.id))));
    });

    it('matches whole and fractional numbers from a long list', async () => {
        const store = await open();
        const values = [...sizes, ...Array.from({ length: 200 }, (_, i) => 10_000 + i)];

        const found = await store.items.where(([x, p]) => p.values.includes(x.size), { values }).toArrayAsync();

        expect(idsOf(found)).toEqual(idsOf(ROWS.filter(row => values.includes(row.size))));
    });

    it('matches text from a long list and leaves null labels out', async () => {
        const store = await open();

        const found = await store.items.where(([x, p]) => p.labels.includes(x.label), { labels }).toArrayAsync();

        expect(idsOf(found)).toEqual(idsOf(ROWS.filter(row => row.label !== null && labels.includes(row.label))));
    });

    it('combines a long list with other parameters in one query', async () => {
        const store = await open();
        const ids = Array.from({ length: 300 }, (_, i) => `i${i}`);

        const found = await store.items.where(([x, p]) => p.ids.includes(x.id) && x.active === p.active && x.size > p.min, { ids, active: true, min: 100 }).toArrayAsync();

        expect(idsOf(found)).toEqual(idsOf(ROWS.filter(row => ids.includes(row.id) && row.active && row.size > 100)));
    });
});
