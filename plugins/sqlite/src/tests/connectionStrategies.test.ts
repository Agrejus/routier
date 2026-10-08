import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import { sqlite3Driver } from '../drivers/sqlite3';
import type { SqliteConnection, SqliteDriver } from '../drivers/types';

const schema = s.define('strategy_rows', { id: s.string().key(), label: s.string() }).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const dirs: string[] = [];

const databaseFile = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-strategy-'));
    dirs.push(dir);
    return path.join(dir, `${uuidv4()}.sqlite`);
};

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

type Gate = { reached: Promise<void>; released: Promise<void>; arrive: () => void; release: () => void };

const gate = (): Gate => {
    let arrive = (): void => undefined;
    let release = (): void => undefined;
    const reached = new Promise<void>(resolve => { arrive = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });

    return { reached, released, arrive: () => arrive(), release: () => release() };
};

const instrumented = (keepsConnections: boolean, options: { failInsertAfter?: Gate } = {}) => {
    const base = { ...nodeSqliteDriver(), keepsConnections };
    let opens = 0;

    const driver: SqliteDriver = {
        ...base,
        async open(name: string): Promise<SqliteConnection> {
            opens++;
            const connection = await base.open(name);

            return {
                all: async (sql, params, result) => {
                    const rows = await connection.all(sql, params, result);

                    if (options.failInsertAfter != null && /^\s*INSERT/i.test(sql) && JSON.stringify(params).includes('doomed')) {
                        options.failInsertAfter.arrive();
                        await options.failInsertAfter.released;
                        throw new Error('the save fails after its insert');
                    }

                    return rows;
                },
                run: (sql, params) => connection.run(sql, params),
                close: () => connection.close(),
                defineFunction: (name, implementation) => connection.defineFunction?.(name, implementation),
            };
        },
    };

    return { driver, opens: () => opens };
};

describe.each([
    ['one connection per operation', false],
    ['a kept writer and reader', true],
])('SQLite with %s', (_label, keepsConnections) => {
    const plugin = (file: string) => new SqliteDbPlugin(file, { driver: instrumented(keepsConnections).driver });

    it('never shows a query the rows of a save that is rolled back', async () => {
        const doomed = gate();
        const { driver } = instrumented(keepsConnections, { failInsertAfter: doomed });
        const shared = new SqliteDbPlugin(databaseFile(), { driver });
        const writer = new Store(shared);

        await writer.rows.addAsync({ id: 'kept', label: 'committed' });
        await writer.saveChangesAsync();

        await writer.rows.addAsync({ id: 'doomed', label: 'rolled back' });
        const save = writer.saveChangesAsync().then(() => 'saved', () => 'failed');
        await doomed.reached;

        const read = new Store(shared).rows.toArrayAsync();
        doomed.release();

        expect(await save).toBe('failed');
        expect((await read).map(row => row.id)).toEqual(['kept']);
    });

    it('lets another plugin on the same file see what was committed', async () => {
        const file = databaseFile();
        const reader = new Store(plugin(file));
        const writer = new Store(plugin(file));

        await writer.rows.addAsync({ id: 'a', label: 'first' });
        await writer.saveChangesAsync();
        expect(await reader.rows.countAsync()).toBe(1);

        await writer.rows.addAsync({ id: 'b', label: 'second' });
        await writer.saveChangesAsync();
        expect(await reader.rows.countAsync()).toBe(2);
    });

    it('applies every save when two plugins write to one file in turn', async () => {
        const file = databaseFile();
        const left = new Store(plugin(file));
        const right = new Store(plugin(file));

        for (let i = 0; i < 5; i++) {
            await left.rows.addAsync({ id: `left-${i}`, label: 'l' });
            await left.saveChangesAsync();
            await right.rows.addAsync({ id: `right-${i}`, label: 'r' });
            await right.saveChangesAsync();
        }

        expect(await new Store(plugin(file)).rows.countAsync()).toBe(10);
    });

    it('removes the database file on destroy', async () => {
        const file = databaseFile();
        const store = new Store(plugin(file));
        await store.rows.addAsync({ id: 'a', label: 'x' });
        await store.saveChangesAsync();
        await store.rows.countAsync();

        await store.destroyAsync();

        expect(fs.existsSync(file)).toBe(false);
    });
});

describe('how many connections are opened', () => {
    const work = async (keepsConnections: boolean) => {
        const { driver, opens } = instrumented(keepsConnections);
        const store = new Store(new SqliteDbPlugin(databaseFile(), { driver }));

        for (let i = 0; i < 10; i++) {
            await store.rows.addAsync({ id: `${i}`, label: 'x' });
            await store.saveChangesAsync();
            await store.rows.countAsync();
        }

        return opens();
    };

    it('opens one per operation for a driver that does not keep them', async () => {
        expect(await work(false)).toBe(20);
    });

    it('opens one writer and one reader for a driver that keeps them', async () => {
        expect(await work(true)).toBe(2);
    });

    it.each([
        ['node:sqlite', nodeSqliteDriver()],
        ['sqlite3', sqlite3Driver()],
    ])('keeps them for %s', (_name, driver) => {
        expect(driver.keepsConnections).toBe(true);
    });
});
