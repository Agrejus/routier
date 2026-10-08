import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import { sqlite3Driver } from '../drivers/sqlite3';
import type { SqliteConnection, SqliteDriver } from '../drivers/types';

const schema = s.define('memory_rows', { id: s.string().key(), label: s.string() }).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

type Gate = { reached: Promise<void>; released: Promise<void>; arrive: () => void; release: () => void };

const gate = (): Gate => {
    let arrive = (): void => undefined;
    let release = (): void => undefined;
    const reached = new Promise<void>(resolve => { arrive = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });

    return { reached, released, arrive: () => arrive(), release: () => release() };
};

const failingAfterInsert = (base: SqliteDriver, doomed: Gate): SqliteDriver => ({
    ...base,
    async open(name: string): Promise<SqliteConnection> {
        const connection = await base.open(name);

        return {
            all: async (sql, params, result) => {
                const rows = await connection.all(sql, params, result);

                if (/^\s*INSERT/i.test(sql) && JSON.stringify(params).includes('doomed')) {
                    doomed.arrive();
                    await doomed.released;
                    throw new Error('the save fails after its insert');
                }

                return rows;
            },
            run: (sql, params) => connection.run(sql, params),
            close: () => connection.close(),
            defineFunction: (name, implementation) => connection.defineFunction?.(name, implementation),
        };
    },
});

describe.each([
    ['node:sqlite', nodeSqliteDriver],
    ['sqlite3', sqlite3Driver],
])('an in-memory database with %s', (_name, driver) => {
    it('returns the rows it saved', async () => {
        const store = new Store(new SqliteDbPlugin(':memory:', { driver: driver() }));

        await store.rows.addAsync({ id: 'a', label: 'first' }, { id: 'b', label: 'second' });
        await store.saveChangesAsync();

        expect((await store.rows.sort(row => row.id).toArrayAsync()).map(row => row.id)).toEqual(['a', 'b']);
        await store.destroyAsync();
    });

    it('keeps its rows across saves and queries', async () => {
        const store = new Store(new SqliteDbPlugin(':memory:', { driver: driver() }));

        for (let i = 0; i < 3; i++) {
            await store.rows.addAsync({ id: `${i}`, label: 'x' });
            await store.saveChangesAsync();
            expect(await store.rows.countAsync()).toBe(i + 1);
        }

        await store.destroyAsync();
    });

    it('never shows a query the rows of a save that is rolled back', async () => {
        const doomed = gate();
        const plugin = new SqliteDbPlugin(':memory:', { driver: failingAfterInsert(driver(), doomed) });
        const writer = new Store(plugin);

        await writer.rows.addAsync({ id: 'kept', label: 'committed' });
        await writer.saveChangesAsync();

        await writer.rows.addAsync({ id: 'doomed', label: 'rolled back' });
        const save = writer.saveChangesAsync().then(() => 'saved', () => 'failed');
        await doomed.reached;

        const read = new Store(plugin).rows.toArrayAsync();
        doomed.release();

        expect(await save).toBe('failed');
        expect((await read).map(row => row.id)).toEqual(['kept']);
        await writer.destroyAsync();
    });

    it('starts empty for every plugin', async () => {
        const first = new Store(new SqliteDbPlugin(':memory:', { driver: driver() }));
        await first.rows.addAsync({ id: 'a', label: 'x' });
        await first.saveChangesAsync();

        const second = new Store(new SqliteDbPlugin(':memory:', { driver: driver() }));

        expect(await second.rows.countAsync()).toBe(0);
        await Promise.all([first.destroyAsync(), second.destroyAsync()]);
    });
});
