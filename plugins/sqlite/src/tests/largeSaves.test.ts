import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import { sqlite3Driver } from '../drivers/sqlite3';
import type { SqliteDriver } from '../drivers/types';

const narrow = s.define('large_narrow', { id: s.string().key(), name: s.string() }).compile();
const pairs = s.define('large_pairs', { left: s.string().key(), right: s.string().key(), name: s.string() }).compile();
const wide = s.define('large_wide', { id: s.string().key(), name: s.string(), field0: s.string(), field1: s.string(), field2: s.string(), field3: s.string(), field4: s.string(), field5: s.string(), field6: s.string(), field7: s.string(), field8: s.string(), field9: s.string(), field10: s.string(), field11: s.string(), field12: s.string(), field13: s.string(), field14: s.string(), field15: s.string(), field16: s.string(), field17: s.string(), field18: s.string(), field19: s.string(), field20: s.string(), field21: s.string(), field22: s.string(), field23: s.string(), field24: s.string(), field25: s.string(), field26: s.string(), field27: s.string(), field28: s.string(), field29: s.string(), field30: s.string(), field31: s.string(), field32: s.string(), field33: s.string(), field34: s.string(), field35: s.string(), field36: s.string(), field37: s.string(), field38: s.string(), field39: s.string() }).compile();

class Store extends DataStore {
    narrow = this.collection(narrow).proxy().create();
    pairs = this.collection(pairs).proxy().create();
    wide = this.collection(wide).proxy().create();
}

const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const pluginFor = (driver: () => SqliteDriver): SqliteDbPlugin => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-large-'));
    dirs.push(dir);
    return new SqliteDbPlugin(path.join(dir, 'large.sqlite'), { driver: driver() });
};

const open = (driver: () => SqliteDriver): Store => new Store(pluginFor(driver));

const wideRow = (i: number) => ({
    id: `w${i}`,
    name: `n${i}`,
    ...Object.fromEntries(Array.from({ length: 40 }, (_, k) => [`field${k}`, `v${k}-${i}`])),
}) as Parameters<Store['wide']['addAsync']>[0];

describe.each([
    ['node:sqlite', nodeSqliteDriver],
    ['sqlite3', sqlite3Driver],
])('saves larger than one SQLite statement allows with %s', (_name, driver) => {
    it('adds 1,000 rows of a 42-column schema', async () => {
        const store = open(driver);

        await store.wide.addAsync(...Array.from({ length: 1000 }, (_, i) => wideRow(i)));
        await store.saveChangesAsync();

        expect(await store.wide.countAsync()).toBe(1000);
        expect((await store.wide.firstAsync(row => row.id === 'w999')).field39).toBe('v39-999');
    }, 120_000);

    it('adds 40,000 rows of a two-column schema and returns each saved row in order', async () => {
        const store = open(driver);
        const added = await store.narrow.addAsync(...Array.from({ length: 40_000 }, (_, i) => ({ id: `n${i}`, name: `name${i}` })));

        const saved = await store.saveChangesAsync();

        expect(saved.aggregate.adds).toBe(40_000);
        expect(await store.narrow.countAsync()).toBe(40_000);
        expect(added.at(-1)?.name).toBe('name39999');
    }, 120_000);

    it('updates 40,000 rows in one save', async () => {
        const store = open(driver);
        await store.narrow.addAsync(...Array.from({ length: 40_000 }, (_, i) => ({ id: `n${i}`, name: 'before' })));
        await store.saveChangesAsync();

        const rows = await store.narrow.toArrayAsync();
        rows.forEach((row, i) => { row.name = `after${i}`; });
        const saved = await store.saveChangesAsync();

        expect(saved.aggregate.updates).toBe(40_000);
        expect(await store.narrow.where(row => row.name === 'before').countAsync()).toBe(0);
    }, 120_000);

    it('removes 3,000 rows in one save', async () => {
        const store = open(driver);
        await store.narrow.addAsync(...Array.from({ length: 3000 }, (_, i) => ({ id: `n${i}`, name: 'x' })));
        await store.saveChangesAsync();

        await store.narrow.removeAsync(...await store.narrow.toArrayAsync());
        const saved = await store.saveChangesAsync();

        expect(saved.aggregate.removes).toBe(3000);
        expect(await store.narrow.countAsync()).toBe(0);
    }, 120_000);

    it('removes 3,000 rows with a composite key in one save', async () => {
        const store = open(driver);
        await store.pairs.addAsync(...Array.from({ length: 3000 }, (_, i) => ({ left: `l${i}`, right: `r${i}`, name: 'x' })));
        await store.saveChangesAsync();

        await store.pairs.removeAsync(...await store.pairs.toArrayAsync());
        await store.saveChangesAsync();

        expect(await store.pairs.countAsync()).toBe(0);
    }, 120_000);

    it('rolls a large save back whole when one of its chunks fails', async () => {
        const plugin = pluginFor(driver);
        const existing = new Store(plugin);
        await existing.narrow.addAsync({ id: 'n39999', name: 'already here' });
        await existing.saveChangesAsync();

        const store = new Store(plugin);
        await store.narrow.addAsync(...Array.from({ length: 40_000 }, (_, i) => ({ id: `n${i}`, name: 'x' })));

        await expect(store.saveChangesAsync()).rejects.toThrow(/UNIQUE/);
        expect(await existing.narrow.countAsync()).toBe(1);
    }, 120_000);
});
