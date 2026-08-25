import { describe, expect, it } from '@jest/globals';
import { decodeChunk, EncodedTransfer, TRANSFER_VERSION, TransferEncoding, TransferPlan } from '@routier/core/transfer';
import { streamChunks } from '../drivers/wasmChunks';
import type { WasmStatement } from '../drivers/wasmRows';
import type { RawSqlite } from '../drivers/wasmRaw';

/**
 * The worker's stepping loop: rows in, chunks out.
 *
 * `last` is the load-bearing flag. Set on the wrong message the driver either resolves a request
 * that is still arriving — silently dropping rows — or never resolves it at all.
 */

const plan = (...columns: [string, TransferEncoding][]): TransferPlan => ({
    version: TRANSFER_VERSION,
    columns: columns.map(([name, encoding]) => ({ name, encoding })),
});

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

/** Runs the loop and decodes everything back, the way the driver would. */
const stream = (source: { subject: WasmStatement; raw: RawSqlite }, subjectPlan: TransferPlan) => {
    const emitted: { transfer: EncodedTransfer; last: boolean }[] = [];

    streamChunks(source.raw, source.subject, subjectPlan, (transfer, last) => emitted.push({ transfer, last }));

    const rows = emitted.flatMap(entry => decodeChunk(subjectPlan, entry.transfer.payload));

    return { rows, emitted, lasts: emitted.map(entry => entry.last) };
};

const CHUNK = 4096;

describe('streamChunks', () => {

    it('emits exactly one chunk for a zero-row result, marked last', () => {
        const source = statement(['id'], []);
        const { rows, lasts } = stream(source, plan(['id', 'float64']));

        expect(rows).toEqual([]);
        expect(lasts).toEqual([true]);
    });

    it('emits one chunk for a result that fits in one', () => {
        const source = statement(['id', 'name'], [[1, 'ada'], [2, 'grace']]);
        const { rows, lasts } = stream(source, plan(['id', 'float64'], ['name', 'clone']));

        expect(rows).toEqual([{ id: 1, name: 'ada' }, { id: 2, name: 'grace' }]);
        expect(lasts).toEqual([true]);
    });

    /**
     * A chunk that fills on the very last row must be marked last, not followed by an empty one.
     * That is the whole reason the loop reads one row ahead.
     */
    it('marks a chunk last when the result is exactly one chunk long', () => {
        const rows = Array.from({ length: CHUNK }, (_, i) => [i]);
        const source = statement(['id'], rows);
        const result = stream(source, plan(['id', 'float64']));

        expect(result.lasts).toEqual([true]);
        expect(result.rows).toHaveLength(CHUNK);
    });

    it.each([CHUNK - 1, CHUNK, CHUNK + 1, CHUNK * 2, CHUNK * 2 + 7])('streams %i rows in order', (count) => {
        const seeded = Array.from({ length: count }, (_, i) => [i]);
        const source = statement(['id'], seeded);
        const { rows, lasts } = stream(source, plan(['id', 'float64']));

        expect(rows).toHaveLength(count);
        expect(rows[0]).toEqual({ id: 0 });
        expect(rows[count - 1]).toEqual({ id: count - 1 });
        expect(lasts.filter(Boolean)).toHaveLength(1);
        expect(lasts[lasts.length - 1]).toBe(true);
        expect(lasts).toHaveLength(Math.max(1, Math.ceil(count / CHUNK)));
    });

    it('marks last exactly once, on the final chunk', () => {
        const seeded = Array.from({ length: CHUNK * 3 }, (_, i) => [i]);
        const source = statement(['id'], seeded);
        const { lasts } = stream(source, plan(['id', 'float64']));

        expect(lasts).toEqual([false, false, true]);
    });

    it('lists the typed buffers of every chunk as transferable', () => {
        const seeded = Array.from({ length: CHUNK + 1 }, (_, i) => [i, 'x']);
        const source = statement(['id', 'name'], seeded);
        const { emitted } = stream(source, plan(['id', 'float64'], ['name', 'clone']));

        // Two per typed column — data and nulls — and nothing for the cloned one.
        expect(emitted).toHaveLength(2);
        expect(emitted[0].transfer.transferables).toHaveLength(2);
        expect(emitted[1].transfer.transferables).toHaveLength(2);
    });

    describe('when the plan and the statement disagree', () => {

        /**
         * Checked before a single row is read. Encoding against a wrong layout would put each
         * column's values under another column's name and report nothing at all.
         */
        it('refuses a plan whose columns are in a different order', () => {
            const source = statement(['b', 'a'], [[1, 2]]);

            expect(() => stream(source, plan(['a', 'float64'], ['b', 'float64'])))
                .toThrow(/does not match/);
        });

        it('refuses a plan that names a column the statement does not return', () => {
            const source = statement(['a'], [[1]]);

            expect(() => stream(source, plan(['a', 'float64'], ['b', 'float64'])))
                .toThrow(/does not match/);
        });

        it('refuses before emitting anything', () => {
            const source = statement(['b'], [[1]]);
            const emitted: unknown[] = [];

            expect(() => streamChunks(source.raw, source.subject, plan(['a', 'float64']), (t) => emitted.push(t))).toThrow();
            expect(emitted).toEqual([]);
        });
    });

    it('decodes the final entity shape, not the raw stored one', () => {
        const source = statement(
            ['id', 'active', 'at', 'meta'],
            [[1, 1, '2026-08-25T00:00:00.000Z', '{"a":1}'], [2, 0, null, null]]
        );

        const { rows } = stream(source, plan(
            ['id', 'float64'], ['active', 'boolean-byte'], ['at', 'date-f64'], ['meta', 'json']
        ));

        expect(rows).toEqual([
            { id: 1, active: true, at: new Date('2026-08-25T00:00:00.000Z'), meta: { a: 1 } },
            { id: 2, active: false, at: null, meta: null },
        ]);
    });
});
