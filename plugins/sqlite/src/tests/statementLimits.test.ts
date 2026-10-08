import { afterAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { chunksOf, rowsPerStatement, SQLITE_MAX_OR_TERMS, SQLITE_MAX_PARAMS } from '../statementLimits';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataStore } from '@routier/datastore';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import type { SqliteConnection, SqliteDriver } from '../drivers/types';

const items = s.define('limit_items', { id: s.string().key(), name: s.string() }).compile();
const pairs = s.define('limit_pairs', { left: s.string().key(), right: s.string().key(), name: s.string() }).compile();

class Store extends DataStore {
    items = this.collection(items).proxy().create();
    pairs = this.collection(pairs).proxy().create();
}

type Statement = { sql: string; params: string[] };

const recording = (log: Statement[]): SqliteDriver => {
    const base = nodeSqliteDriver();

    return {
        ...base,
        async open(name: string): Promise<SqliteConnection> {
            const connection = await base.open(name);

            return {
                all: async (sql, params, result) => {
                    const rows = await connection.all(sql, params, result);
                    log.push({ sql, params: (params ?? []).map(String) });
                    return rows;
                },
                run: (sql, params) => connection.run(sql, params),
                close: () => connection.close(),
            };
        },
    };
};

const dirs: string[] = [];

afterAll(() => {
    for (const dir of dirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const open = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-limits-'));
    dirs.push(dir);
    const log: Statement[] = [];
    return { store: new Store(new SqliteDbPlugin(path.join(dir, 'limits.sqlite'), { driver: recording(log) })), log };
};

const itemRows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `i${i}`, name: `n${i}` }));
const pairRows = (count: number) => Array.from({ length: count }, (_, i) => ({ left: `l${i}`, right: `r${i}`, name: `n${i}` }));

const sizesOf = (log: Statement[], verb: string) => log.filter(statement => statement.sql.startsWith(verb)).map(statement => statement.params.length);

describe('chunksOf', () => {
    it.each([
        [[], 2, []],
        [[1, 2, 3, 4], 2, [[1, 2], [3, 4]]],
        [[1, 2, 3, 4, 5], 2, [[1, 2], [3, 4], [5]]],
        [[1, 2], 5, [[1, 2]]],
    ])('splits %j into chunks of %i', (input, size, expected) => {
        expect(chunksOf(input, size)).toEqual(expected);
    });
});

describe('rowsPerStatement', () => {
    it.each([
        ['fits as many rows as the parameter limit allows', 2, undefined, Math.floor(SQLITE_MAX_PARAMS / 2)],
        ['treats a row with no parameters as one parameter', 0, undefined, SQLITE_MAX_PARAMS],
        ['caps the rows at the given maximum', 1, SQLITE_MAX_OR_TERMS, SQLITE_MAX_OR_TERMS],
        ['ignores a cap above what the parameters allow', 4, SQLITE_MAX_PARAMS, Math.floor(SQLITE_MAX_PARAMS / 4)],
        ['still sends one row when a row alone exceeds the limit', SQLITE_MAX_PARAMS + 1, undefined, 1],
    ])('%s', (_label, paramsPerRow, maxRows, expected) => {
        expect(rowsPerStatement(paramsPerRow, maxRows)).toBe(expected);
    });
});

describe('splitting a save into statements', () => {
    const perInsert = Math.floor(SQLITE_MAX_PARAMS / 2);
    const perUpdate = Math.floor(SQLITE_MAX_PARAMS / 7);

    it.each([
        ['fills one INSERT to the parameter limit', perInsert, [perInsert * 2]],
        ['starts a second INSERT one row past it', perInsert + 1, [perInsert * 2, 2]],
    ])('%s', async (_label, count, expected) => {
        const { store, log } = open();
        await store.items.addAsync(...itemRows(count));
        await store.saveChangesAsync();

        expect(sizesOf(log, 'INSERT')).toEqual(expected);
    });

    it('keeps every added row, in order, across the INSERTs', async () => {
        const { store, log } = open();
        await store.items.addAsync(...itemRows(perInsert + 1));
        await store.saveChangesAsync();

        const params = log.filter(statement => statement.sql.startsWith('INSERT')).flatMap(statement => statement.params);

        expect(params.slice(-4)).toEqual([`i${perInsert - 1}`, `n${perInsert - 1}`, `i${perInsert}`, `n${perInsert}`]);
    });

    it.each([
        ['one DELETE up to the OR limit', SQLITE_MAX_OR_TERMS, [SQLITE_MAX_OR_TERMS]],
        ['a second DELETE one row past it', SQLITE_MAX_OR_TERMS + 1, [SQLITE_MAX_OR_TERMS, 1]],
    ])('removes with %s', async (_label, count, expected) => {
        const { store, log } = open();
        await store.items.addAsync(...itemRows(count));
        await store.saveChangesAsync();

        await store.items.removeAsync(...await store.items.toArrayAsync());
        await store.saveChangesAsync();

        expect(sizesOf(log, 'DELETE')).toEqual(expected);
    });

    it('applies the same row limit to a composite key', async () => {
        const { store, log } = open();
        await store.pairs.addAsync(...pairRows(SQLITE_MAX_OR_TERMS + 1));
        await store.saveChangesAsync();

        await store.pairs.removeAsync(...await store.pairs.toArrayAsync());
        await store.saveChangesAsync();

        expect(sizesOf(log, 'DELETE')).toEqual([SQLITE_MAX_OR_TERMS * 2, 2]);
    });

    it.each([
        ['one UPDATE up to the parameter limit', perUpdate, 1],
        ['a second UPDATE one row past it', perUpdate + 1, 2],
    ])('updates with %s', async (_label, count, expected) => {
        const { store, log } = open();
        await store.items.addAsync(...itemRows(count));
        await store.saveChangesAsync();

        for (const row of await store.items.toArrayAsync()) {
            row.name = `${row.name}!`;
        }
        await store.saveChangesAsync();

        expect(sizesOf(log, 'UPDATE')).toHaveLength(expected);
    });
});
