import { describe, expect, it } from '@jest/globals';
import { readRows, WasmStatement } from '../drivers/wasmRows';
import type { RawSqlite } from '../drivers/wasmRaw';

/**
 * `get({})` resolved the column names from the statement on every row, and sqlite-wasm leaves the
 * object form's property order undefined. `readRows` reads names once and uses the array form,
 * whose order is the result column order.
 */

type Cell = unknown;

/**
 * A statement over a fixed result set, and the raw surface that reads it.
 *
 * Values carry their SQLite storage class, because the reader dispatches on it — a fake that
 * ignored types would not exercise the NULL and integer paths that make the reader correct.
 */
const statement = (names: string[], rows: unknown[][]) => {
    let index = -1;
    let finalized = false;
    let columnNameReads = 0;

    const subject = {
        bind() { },
        getColumnNames() {
            columnNameReads += 1;
            return [...names];
        },
        finalize() {
            finalized = true;
        },
        pointer: 1,
    } satisfies WasmStatement;

    const valueAt = (column: number) => rows[index][column];

    const raw: RawSqlite = {
        step() {
            index += 1;
            return index < rows.length;
        },
        columnType(_statement, column) {
            const value = valueAt(column);

            if (value === null || value === undefined) return 5;   // NULL
            if (typeof value === 'bigint') return 1;               // INTEGER
            if (typeof value === 'number') return Number.isInteger(value) ? 1 : 2;
            if (typeof value === 'string') return 3;               // TEXT
            return 4;                                              // BLOB
        },
        columnDouble(_statement, column) {
            const value = valueAt(column);

            return typeof value === 'bigint' ? Number(value) : value as number;
        },
        columnBigInt(_statement, column) {
            return valueAt(column) as bigint;
        },
        text(_statement, column) {
            return valueAt(column) as string;
        },
        blob(_statement, column) {
            return valueAt(column) as Uint8Array;
        },
    };

    return { subject, raw, isFinalized: () => finalized, reads: () => columnNameReads };
};

describe('readRows', () => {

    it('returns nothing for a statement with no rows', () => {
        const source = statement(['id', 'name'], []);

        expect(readRows(source.raw, source.subject)).toEqual([]);
    });

    it('keys each row by its column name', () => {
        const source = statement(['id', 'name'], [[1, 'alice'], [2, 'bob']]);

        expect(readRows(source.raw, source.subject)).toEqual([
            { id: 1, name: 'alice' },
            { id: 2, name: 'bob' },
        ]);
    });

    it('reads the column names once rather than once per row', () => {
        const source = statement(['id'], [[1], [2], [3], [4]]);

        readRows(source.raw, source.subject);

        expect(source.reads()).toBe(1);
    });

    it('uses the alias a projection gave the column, not the underlying name', () => {
        const source = statement(['o__name', 'i__name'], [['outer', 'inner']]);

        expect(readRows(source.raw, source.subject)).toEqual([{ o__name: 'outer', i__name: 'inner' }]);
    });

    it('keeps a SQL NULL as null rather than dropping the property', () => {
        const source = statement(['id', 'deletedAt'], [[1, null]]);
        const rows = readRows(source.raw, source.subject) as Record<string, unknown>[];

        expect(rows).toEqual([{ id: 1, deletedAt: null }]);
        expect('deletedAt' in rows[0]).toBe(true);
    });

    it('carries every scalar shape SQLite returns through untouched', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const big = BigInt('9007199254740993');
        const source = statement(
            ['text', 'real', 'integer', 'nothing', 'blob', 'big'],
            [['a', 1.5, 0, null, bytes, big]]
        );

        expect(readRows(source.raw, source.subject)).toEqual([
            { text: 'a', real: 1.5, integer: 0, nothing: null, blob: bytes, big },
        ]);
    });

    it('assigns the properties in result column order, so every row shares one shape', () => {
        const source = statement(['b', 'a', 'c'], [[1, 2, 3], [4, 5, 6]]);
        const rows = readRows(source.raw, source.subject) as Record<string, unknown>[];

        expect(Object.keys(rows[0])).toEqual(['b', 'a', 'c']);
        expect(Object.keys(rows[1])).toEqual(['b', 'a', 'c']);
    });

    it('reads a column the statement names twice as the last of the two', () => {
        // SQLite allows `SELECT id, id FROM t`. One object cannot hold both, and the array form
        // makes the second win rather than leaving it to property-order chance.
        const source = statement(['id', 'id'], [[1, 2]]);

        expect(readRows(source.raw, source.subject)).toEqual([{ id: 2 }]);
    });
});
