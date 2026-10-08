import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import { nodeSqliteDriver } from '../drivers/nodeSqlite';
import { STATEMENT_CACHE_MAX } from '../drivers/statementCache';

const openSeeded = async () => {
    const connection = await nodeSqliteDriver().open(':memory:');
    await connection.run('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    await connection.run('INSERT INTO items (id, name) VALUES (?, ?), (?, ?)', [1, 'a', 2, 'b']);
    return connection;
};

describe('node:sqlite statement cache', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('prepares a repeated query once and binds each call\'s parameters', async () => {
        const connection = await openSeeded();
        const prepare = jest.spyOn(DatabaseSync.prototype, 'prepare');

        const first = await connection.all('SELECT name FROM items WHERE id = ?', [1]);
        const second = await connection.all('SELECT name FROM items WHERE id = ?', [2]);

        expect([first, second]).toEqual([[{ name: 'a' }], [{ name: 'b' }]]);
        expect(prepare).toHaveBeenCalledTimes(1);
        await connection.close();
    });

    it('prepares a repeated parameterized write once', async () => {
        const connection = await openSeeded();
        const prepare = jest.spyOn(DatabaseSync.prototype, 'prepare');

        await connection.run('INSERT INTO items (id, name) VALUES (?, ?)', [3, 'c']);
        await connection.run('INSERT INTO items (id, name) VALUES (?, ?)', [4, 'd']);

        expect(prepare).toHaveBeenCalledTimes(1);
        expect(await connection.all('SELECT COUNT(*) AS n FROM items')).toEqual([{ n: 4 }]);
        await connection.close();
    });

    it('prepares different sql separately', async () => {
        const connection = await openSeeded();
        const prepare = jest.spyOn(DatabaseSync.prototype, 'prepare');

        await connection.all('SELECT id FROM items');
        await connection.all('SELECT name FROM items');

        expect(prepare).toHaveBeenCalledTimes(2);
        await connection.close();
    });

    it('keeps separate caches per connection', async () => {
        const one = await openSeeded();
        const two = await openSeeded();
        const prepare = jest.spyOn(DatabaseSync.prototype, 'prepare');

        await one.all('SELECT id FROM items');
        await two.all('SELECT id FROM items');

        expect(prepare).toHaveBeenCalledTimes(2);
        await Promise.all([one.close(), two.close()]);
    });

    it('re-prepares a statement evicted from a full cache', async () => {
        const connection = await openSeeded();
        const prepare = jest.spyOn(DatabaseSync.prototype, 'prepare');

        for (let i = 0; i <= STATEMENT_CACHE_MAX; i++) {
            await connection.all(`SELECT ${i} AS n`);
        }
        await connection.all('SELECT 0 AS n');

        expect(prepare).toHaveBeenCalledTimes(STATEMENT_CACHE_MAX + 2);
        await connection.close();
    });

    it('sees a column added after the query was cached', async () => {
        const connection = await openSeeded();

        await connection.all('SELECT * FROM items WHERE id = ?', [1]);
        await connection.run('ALTER TABLE items ADD COLUMN extra TEXT');

        expect(await connection.all('SELECT * FROM items WHERE id = ?', [1])).toEqual([{ id: 1, name: 'a', extra: null }]);
        await connection.close();
    });

    it('still runs a cached query after a failed call to it', async () => {
        const connection = await openSeeded();

        await expect(connection.run('INSERT INTO items (id, name) VALUES (?, ?)', [1, 'dup'])).rejects.toThrow();
        await connection.run('INSERT INTO items (id, name) VALUES (?, ?)', [5, 'e']);

        expect(await connection.all('SELECT name FROM items WHERE id = ?', [5])).toEqual([{ name: 'e' }]);
        await connection.close();
    });
});
