import { describe, expect, it } from '@jest/globals';
import { RawSqlite, readColumn, readRowInto } from '../drivers/wasmRaw';

/**
 * Reading one value the way sqlite-wasm's own `Stmt.get` would, without its per-value overhead.
 *
 * The dispatch is what makes this correct rather than merely fast: `columnDouble` answers `0` for
 * a SQL NULL, so a reader that trusted it would turn every null number into zero and never report
 * anything.
 */

/** Records which raw calls were made, so the cheap paths can be shown to stay cheap. */
const sqlite = (types: number[], values: unknown[]) => {
    const calls: string[] = [];

    const raw: RawSqlite = {
        step() {
            calls.push('step');
            return false;
        },
        columnType(_statement, column) {
            calls.push(`type:${column}`);
            return types[column];
        },
        columnDouble(_statement, column) {
            calls.push(`double:${column}`);
            return values[column] as number;
        },
        columnBigInt(_statement, column) {
            calls.push(`bigint:${column}`);
            return values[column] as bigint;
        },
        text(_statement, column) {
            calls.push(`text:${column}`);
            return values[column] as string;
        },
        blob(_statement, column) {
            calls.push(`blob:${column}`);
            return values[column] as Uint8Array;
        },
    };

    return { raw, calls };
};

const NULL = 5;
const INTEGER = 1;
const FLOAT = 2;
const TEXT = 3;
const BLOB = 4;

describe('readColumn', () => {

    it('reads a SQL NULL as null, and does not fetch a value for it', () => {
        const { raw, calls } = sqlite([NULL], [0]);

        expect(readColumn(raw, 1, 0)).toBeNull();
        expect(calls).toEqual(['type:0']);
    });

    it('reads a float', () => {
        const { raw } = sqlite([FLOAT], [1.5]);

        expect(readColumn(raw, 1, 0)).toBe(1.5);
    });

    it('reads an integer as a number, without touching the bigint path', () => {
        const { raw, calls } = sqlite([INTEGER], [42]);

        expect(readColumn(raw, 1, 0)).toBe(42);
        expect(calls).toEqual(['type:0', 'double:0']);
    });

    it('reads zero as zero, which is the value NULL would be confused with', () => {
        const { raw } = sqlite([INTEGER], [0]);

        expect(readColumn(raw, 1, 0)).toBe(0);
    });

    it('reads text', () => {
        const { raw } = sqlite([TEXT], ['ada']);

        expect(readColumn(raw, 1, 0)).toBe('ada');
    });

    it('reads a blob', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const { raw } = sqlite([BLOB], [bytes]);

        expect(readColumn(raw, 1, 0)).toBe(bytes);
    });

    /**
     * A double is exact for every integer routier writes. Beyond 2^53 it rounds to a multiple of
     * two, which is never a safe integer — so the check catches it and the value comes back as the
     * `BigInt` sqlite-wasm itself would have returned, rather than as a quietly wrong number.
     */
    it('falls back to a bigint for an integer a double cannot hold exactly', () => {
        const big = BigInt('9007199254740993');
        const { raw, calls } = sqlite([INTEGER], [big]);
        // A real `columnDouble` would round this; the fake cannot, so stub just that call.
        const rounded = { ...raw, columnDouble: () => Number.MAX_SAFE_INTEGER + 1 };

        expect(readColumn(rounded, 1, 0)).toBe(big);
        expect(calls).toEqual(['type:0', 'bigint:0']);
    });

    it.each([
        ['just inside the safe range', Number.MAX_SAFE_INTEGER, false],
        ['just outside it', Number.MAX_SAFE_INTEGER + 1, true],
        ['negative, just inside', Number.MIN_SAFE_INTEGER, false],
    ])('decides the bigint fallback correctly %s', (_, value, expectsBigInt) => {
        const { raw, calls } = sqlite([INTEGER], [value]);

        readColumn(raw, 1, 0);

        expect(calls.includes('bigint:0')).toBe(expectsBigInt);
    });

    it('refuses a storage class SQLite does not have', () => {
        const { raw } = sqlite([9], [0]);

        expect(() => readColumn(raw, 1, 0)).toThrow(/unknown column type: 9/);
    });
});

describe('readRowInto', () => {

    it('fills the array it is given and answers it', () => {
        const { raw } = sqlite([INTEGER, TEXT, NULL], [1, 'ada', null]);
        const into: unknown[] = new Array(3);

        expect(readRowInto(raw, 1, 3, into)).toBe(into);
        expect(into).toEqual([1, 'ada', null]);
    });

    /** One array serves a whole result; every consumer copies out before the next step. */
    it('overwrites every slot, so a reused array cannot leak a previous row', () => {
        const first = sqlite([INTEGER, TEXT], [1, 'ada']);
        const into: unknown[] = new Array(2);

        readRowInto(first.raw, 1, 2, into);

        const second = sqlite([NULL, NULL], [null, null]);

        readRowInto(second.raw, 1, 2, into);

        expect(into).toEqual([null, null]);
    });
});
