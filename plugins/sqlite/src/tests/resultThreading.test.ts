import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { ResultColumn } from '@routier/core/plugins';
import { DataStore } from '@routier/datastore';
import { SqliteDbPluginBase } from '../plugin';
import type { SqliteConnection, SqliteDriver } from '../drivers/types';

/**
 * That the result description actually reaches the driver, on every path that runs a statement.
 *
 * The description is a hint and every driver may ignore it, so nothing FAILS when it goes
 * missing — a dropped description just means a slower route, silently. These are the assertions
 * that would notice.
 */

const schema = s.define('threaded', {
    id: s.string().key().identity(),
    name: s.string(),
    age: s.number(),
    createdAt: s.date(),
}).compile();

const tagSchema = s.define('threaded_tags', {
    id: s.string().key().identity(),
    itemId: s.string(),
    label: s.string(),
}).compile();

class Store extends DataStore {
    items = this.collection(schema).proxy().create();
    tags = this.collection(tagSchema).proxy().create();
}

type Call = { sql: string; result?: readonly ResultColumn[] };

/**
 * Records every `all` and answers with nothing.
 *
 * `failFirstWith` makes the first statement fail the way SQLite reports a table that does not
 * exist yet, which is the lazy-creation path every new collection takes once.
 */
const recordingDriver = (options: { failFirstWith?: string } = {}) => {
    const calls: Call[] = [];
    const ran: string[] = [];
    let pending = options.failFirstWith;

    const connection: SqliteConnection = {
        async all(sql, _params, result) {
            calls.push({ sql, result });

            if (pending != null) {
                const message = pending;
                pending = undefined;
                throw new Error(message);
            }

            return [];
        },
        async run(sql) {
            ran.push(sql);
        },
        async close() { },
    };

    const driver: SqliteDriver = {
        foldsUnicodeCasing: false,
        name: 'recording',
        async open() { return connection; },
        async deleteDatabase() { },
    };

    return { driver, calls, ran };
};

const stores: Store[] = [];

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const open = (driver: SqliteDriver) => {
    const store = new Store(new SqliteDbPluginBase(':memory:', driver));

    stores.push(store);

    return store;
};

const names = (result?: readonly ResultColumn[]) => result?.map(column => column.name);

describe('reaching the driver', () => {

    it('describes the result of an entity read', async () => {
        const { driver, calls } = recordingDriver();

        await open(driver).items.toArrayAsync();

        expect(calls).toHaveLength(1);
        expect(names(calls[0].result)).toEqual(['id', 'name', 'age', 'createdAt']);
    });

    it('describes the result of a projection', async () => {
        const { driver, calls } = recordingDriver();

        await open(driver).items.map(x => ({ who: x.name })).toArrayAsync();

        expect(names(calls[0].result)).toEqual(['name']);
    });

    it('describes the RETURNING row of a write', async () => {
        const { driver, calls } = recordingDriver();
        const store = open(driver);

        await store.items.addAsync({ name: 'ada', age: 36, createdAt: new Date() } as never);
        await store.saveChangesAsync();

        const insert = calls.find(call => call.sql.startsWith('INSERT'));

        expect(insert).toBeDefined();
        expect(names(insert?.result)).toEqual(['id', 'name', 'age', 'createdAt']);
    });

    it('describes the flat row of a pushed-down join, under its per-side aliases', async () => {
        const { driver, calls } = recordingDriver();

        await open(driver).items.join(t => t.tags, i => i.id, t => t.itemId).toArrayAsync();

        expect(calls[0].sql).toContain('JOIN');
        expect(names(calls[0].result)).toEqual([
            'o__id', 'o__name', 'o__age', 'o__createdAt',
            'i__id', 'i__itemId', 'i__label',
        ]);
    });

    it('describes nothing for an aggregate, which replaces the select list', async () => {
        const { driver, calls } = recordingDriver();

        await open(driver).items.countAsync();

        expect(calls[0].sql).toContain('COUNT(*)');
        expect(calls[0].result).toBeUndefined();
    });
});

describe('the missing-table retry', () => {

    /**
     * Lazy table creation means the FIRST statement against a new collection always misses. A
     * retry that dropped the description would leave that one path slower than every later one,
     * with nothing to report it.
     */
    it('passes the same description on the retry', async () => {
        const { driver, calls, ran } = recordingDriver({ failFirstWith: 'no such table: threaded' });

        await open(driver).items.toArrayAsync();

        expect(ran.some(sql => sql.includes('CREATE TABLE'))).toBe(true);
        expect(calls).toHaveLength(2);
        expect(names(calls[1].result)).toEqual(names(calls[0].result));
        expect(names(calls[1].result)).toEqual(['id', 'name', 'age', 'createdAt']);
    });

    it('rethrows an error that is not a missing table, without retrying', async () => {
        const { driver, calls } = recordingDriver({ failFirstWith: 'database is locked' });

        await expect(open(driver).items.toArrayAsync()).rejects.toThrow(/database is locked/);
        expect(calls).toHaveLength(1);
    });
});

describe('drivers that ignore the description', () => {

    /**
     * Every driver but the WASM one takes two parameters and is assignable to the three-parameter
     * signature unchanged. Passing a description to one is a no-op by construction, and this is
     * the assertion that it stays one.
     */
    it('returns the same rows whether or not a description is passed', async () => {
        const { nodeSqliteDriver } = await import('../drivers/nodeSqlite');
        const driver = nodeSqliteDriver();
        const connection = await driver.open(':memory:');

        try {
            await connection.run('CREATE TABLE t ("id" INTEGER, "name" TEXT)');
            await connection.run(`INSERT INTO t VALUES (1, 'ada'), (2, 'grace')`);

            const described: readonly ResultColumn[] = [
                { name: 'id', property: null },
                { name: 'name', property: null },
            ];

            const without = await connection.all('SELECT "id", "name" FROM t');
            const with_ = await connection.all('SELECT "id", "name" FROM t', [], described);

            expect(with_).toEqual(without);
            expect(without).toEqual([{ id: 1, name: 'ada' }, { id: 2, name: 'grace' }]);
        } finally {
            await connection.close();
        }
    });
});
