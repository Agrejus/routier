import { beforeEach, describe, expect, it } from '@jest/globals';
import { ChunkEncoder } from './ChunkEncoder';
import { clearDecoderCache, decodeChunk, isTransferJsonError, isTransferCodecSupported } from './decoder';
import {
    assertColumnLayout,
    CHUNK_ROWS,
    EncodedChunk,
    TransferColumn,
    TransferEncoding,
    TransferPlan,
    TRANSFER_VERSION,
} from './types';

/**
 * The codec on its own — column values in, row objects out. No SQL and no worker.
 *
 * Every case asserts the DECODED rows, because identical rows are the only thing the codec
 * promises. How a chunk is laid out is version-scoped and free to change.
 */

const plan = (...columns: [string, TransferEncoding][]): TransferPlan => ({
    version: TRANSFER_VERSION,
    columns: columns.map(([name, encoding]): TransferColumn => ({ name, encoding })),
});

/** Encodes rows through as many chunks as they need, and decodes every one back. */
const roundTrip = (subject: TransferPlan, rows: unknown[][]) => {
    const encoder = new ChunkEncoder(subject);
    const chunks: EncodedChunk[] = [];
    const decoded: unknown[] = [];

    for (const row of rows) {
        if (encoder.isFull) {
            chunks.push(encoder.take().payload);
        }

        encoder.appendRow(row);
    }

    chunks.push(encoder.take().payload);

    for (const chunk of chunks) {
        decoded.push(...decodeChunk(subject, chunk));
    }

    return { rows: decoded, chunks };
};

beforeEach(() => {
    // The cache is keyed by layout and lives for the process, so one test's compiled decoder
    // would otherwise serve another's identical layout and hide a generation failure.
    clearDecoderCache();
});

describe('round trip', () => {

    it('decodes a zero-row result as no rows, from exactly one chunk', () => {
        const { rows, chunks } = roundTrip(plan(['id', 'float64'], ['meta', 'json']), []);

        expect(rows).toEqual([]);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].rowCount).toBe(0);
    });

    it('decodes a single row', () => {
        const { rows } = roundTrip(plan(['id', 'float64']), [[7]]);

        expect(rows).toEqual([{ id: 7 }]);
    });

    it('decodes every encoding to its final entity shape', () => {
        const subject = plan(
            ['id', 'float64'],
            ['isActive', 'boolean-byte'],
            ['createdAt', 'date-f64'],
            ['name', 'clone'],
            ['meta', 'json'],
        );

        const { rows } = roundTrip(subject, [
            [1, 1, '2026-08-25T12:00:00.000Z', 'alice', '{"a":1}'],
            [2, 0, '1999-01-02T03:04:05.678Z', 'bob', '[1,2,3]'],
        ]);

        expect(rows).toEqual([
            { id: 1, isActive: true, createdAt: new Date('2026-08-25T12:00:00.000Z'), name: 'alice', meta: { a: 1 } },
            { id: 2, isActive: false, createdAt: new Date('1999-01-02T03:04:05.678Z'), name: 'bob', meta: [1, 2, 3] },
        ]);
    });

    it('gives every row the same property order as the plan, so they share one shape', () => {
        const subject = plan(['b', 'float64'], ['a', 'clone'], ['c', 'boolean-byte']);
        const { rows } = roundTrip(subject, [[1, 'x', 1], [2, 'y', 0]]);

        expect(Object.keys(rows[0] as object)).toEqual(['b', 'a', 'c']);
        expect(Object.keys(rows[1] as object)).toEqual(['b', 'a', 'c']);
    });

    it('carries a column name that is not an identifier', () => {
        const subject = plan(['o__first name', 'clone'], ['i__id', 'float64']);
        const { rows } = roundTrip(subject, [['ada', 3]]);

        expect(rows).toEqual([{ 'o__first name': 'ada', i__id: 3 }]);
    });

    /**
     * `__proto__` is the one name that is not just a string. Assigned onto a plain object it
     * reaches `Object.prototype`'s setter instead of becoming an own property, and quoted in an
     * object literal it sets the row's prototype (Annex B.3.1). Both lose the column silently.
     */
    it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])('carries a column named %s', (name) => {
        const subject = plan([name, 'clone'], ['id', 'float64']);
        const { rows } = roundTrip(subject, [['carried', 1]]);
        const row = rows[0] as Record<string, unknown>;

        expect(Object.prototype.hasOwnProperty.call(row, name)).toBe(true);
        expect(row[name]).toBe('carried');
        expect(row.id).toBe(1);
    });

    it('keeps a __proto__ column through a transport that clones the chunk', () => {
        const subject = plan(['__proto__', 'float64'], ['id', 'clone']);
        const encoder = new ChunkEncoder(subject);

        encoder.appendRow([5, 'a']);

        // Same-realm the prototype setter would still read back through the getter; the loss only
        // shows up once the chunk crosses a transport, which is every real use of this codec.
        const crossed = structuredClone(encoder.take().payload);
        const decoded = decodeChunk(subject, crossed);
        const row = decoded[0] as Record<string, unknown>;

        // Read the property rather than compare against a literal: `{ '__proto__': 5 }` in the
        // expectation would set the prototype and assert nothing.
        expect(decoded).toHaveLength(1);
        expect(Object.prototype.hasOwnProperty.call(row, '__proto__')).toBe(true);
        expect(row['__proto__']).toBe(5);
        expect(row.id).toBe('a');
    });

    it('does not decode a column the plan names but the chunk only inherits', () => {
        const subject = plan(['toString', 'clone']);
        const { chunks } = roundTrip(subject, [['x']]);
        const stripped = { ...chunks[0], columns: {} };

        expect(() => decodeChunk(subject, stripped)).toThrow(/no column 'toString'/);
    });
});

describe('nulls', () => {

    it('decodes a SQL NULL as null in every typed encoding', () => {
        const subject = plan(['n', 'float64'], ['b', 'boolean-byte'], ['d', 'date-f64']);
        const { rows } = roundTrip(subject, [[null, null, null]]);

        expect(rows).toEqual([{ n: null, b: null, d: null }]);
    });

    it('assigns the property rather than leaving it absent', () => {
        const { rows } = roundTrip(plan(['n', 'float64']), [[null]]);

        expect('n' in (rows[0] as object)).toBe(true);
        expect((rows[0] as { n: unknown }).n).toBeNull();
    });

    it('treats undefined as a null, because a missing value is not a number', () => {
        const { rows } = roundTrip(plan(['n', 'float64']), [[undefined]]);

        expect(rows).toEqual([{ n: null }]);
    });

    it('decodes a column that is entirely null', () => {
        const rows: unknown[][] = Array.from({ length: 20 }, (): unknown[] => [null]);
        const expected: unknown[] = rows.map((): unknown => ({ n: null }));

        expect(roundTrip(plan(['n', 'float64']), rows).rows).toEqual(expected);
    });

    it('decodes a SQL NULL in a json column as null', () => {
        const { rows } = roundTrip(plan(['meta', 'json']), [[null], ['{"a":1}'], [null]]);

        expect(rows).toEqual([{ meta: null }, { meta: { a: 1 } }, { meta: null }]);
    });

    // A LEFT JOIN produces NULL for a non-nullable property, and so does an aggregate over
    // empty input, so every typed column carries a bitmap whatever the schema says.
    it.each([7, 8, 9, 15, 16, 17])('reads the bitmap correctly across byte boundary at %i rows', (count) => {
        const rows = Array.from({ length: count }, (_, i) => [i % 2 === 0 ? null : i]);
        const { rows: decoded } = roundTrip(plan(['n', 'float64']), rows);

        expect(decoded).toEqual(rows.map(([value]) => ({ n: value ?? null })));
    });
});

describe('chunking', () => {

    it.each([CHUNK_ROWS - 1, CHUNK_ROWS, CHUNK_ROWS + 1])('round-trips %i rows across chunk boundaries', (count) => {
        const rows = Array.from({ length: count }, (_, i) => [i, i % 2 === 0 ? 1 : 0]);
        const { rows: decoded } = roundTrip(plan(['id', 'float64'], ['flag', 'boolean-byte']), rows);

        expect(decoded).toHaveLength(count);
        expect(decoded[0]).toEqual({ id: 0, flag: true });
        expect(decoded[count - 1]).toEqual({ id: count - 1, flag: (count - 1) % 2 === 0 });
    });

    it('exact-sizes a short final chunk, because transfer moves the whole buffer', () => {
        const encoder = new ChunkEncoder(plan(['id', 'float64']));

        for (let i = 0; i < 10; i++) {
            encoder.appendRow([i]);
        }

        const { payload } = encoder.take();
        const column = payload.columns.id;

        expect(column.encoding).toBe('float64');
        expect((column as { data: Float64Array }).data).toHaveLength(10);
        expect((column as { nulls: Uint8Array }).nulls).toHaveLength(2);
    });

    it('allocates fresh buffers per chunk, so a transferred one is never touched again', () => {
        const encoder = new ChunkEncoder(plan(['id', 'float64']));

        for (let i = 0; i < CHUNK_ROWS; i++) {
            encoder.appendRow([i]);
        }

        const first = encoder.take().payload.columns.id as { data: Float64Array };
        encoder.appendRow([99]);
        const second = encoder.take().payload.columns.id as { data: Float64Array };

        expect(second.data.buffer).not.toBe(first.data.buffer);
        expect(first.data[0]).toBe(0);
    });

    it('refuses a row past the chunk size rather than growing', () => {
        const encoder = new ChunkEncoder(plan(['id', 'float64']));

        for (let i = 0; i < CHUNK_ROWS; i++) {
            encoder.appendRow([i]);
        }

        expect(() => encoder.appendRow([CHUNK_ROWS])).toThrow(/full/);
    });
});

describe('transfer', () => {

    const transferables = (subject: TransferPlan, rows: unknown[][]) => {
        const encoder = new ChunkEncoder(subject);

        rows.forEach(row => encoder.appendRow(row));

        return encoder.take();
    };

    it('lists both buffers of every typed column, and nothing else', () => {
        const subject = plan(['id', 'float64'], ['name', 'clone'], ['meta', 'json'], ['flag', 'boolean-byte']);
        const { transferables: list } = transferables(subject, [[1, 'a', '{}', 1]]);

        expect(list).toHaveLength(4);
    });

    it('decodes identically whether the transport transferred the buffers or cloned them', () => {
        const subject = plan(['id', 'float64'], ['when', 'date-f64'], ['name', 'clone'], ['meta', 'json']);
        const rows = [[1, '2026-01-01T00:00:00.000Z', 'a', '{"x":1}'], [null, null, null, null]];

        const cloned = transferables(subject, rows);
        const moved = transferables(subject, rows);

        const withoutList = structuredClone(cloned.payload);
        const withList = structuredClone(moved.payload, { transfer: [...moved.transferables] as Transferable[] });

        expect(decodeChunk(subject, withList)).toEqual(decodeChunk(subject, withoutList));
    });

    it('detaches the sender buffers, which is the point of the transfer list', () => {
        const subject = plan(['id', 'float64']);
        const { payload, transferables: list } = transferables(subject, [[1]]);
        const sent = payload.columns.id as { data: Float64Array };

        structuredClone(payload, { transfer: [...list] as Transferable[] });

        expect(sent.data.byteLength).toBe(0);
    });
});

describe('runtime column fallback', () => {

    it('sends a numeric column holding text to clone, keeping the rest of the result', () => {
        const subject = plan(['id', 'float64'], ['name', 'clone']);
        const { rows } = roundTrip(subject, [[1, 'a'], ['not a number', 'b'], [3, 'c']]);

        expect(rows).toEqual([
            { id: 1, name: 'a' },
            { id: 'not a number', name: 'b' },
            { id: 3, name: 'c' },
        ]);
    });

    it('sends a bigint above 2^53 to clone rather than losing precision in a Float64Array', () => {
        const big = BigInt('9007199254740993');
        const { rows, chunks } = roundTrip(plan(['id', 'float64']), [[1], [big]]);

        expect(rows).toEqual([{ id: 1 }, { id: big }]);
        expect(chunks[0].columns.id.encoding).toBe('clone');
    });

    it('keeps NaN and the infinities in float64, because those are real numbers', () => {
        const { rows, chunks } = roundTrip(plan(['n', 'float64']), [[NaN], [Infinity], [-Infinity]]);

        expect(chunks[0].columns.n.encoding).toBe('float64');
        expect(rows).toEqual([{ n: NaN }, { n: Infinity }, { n: -Infinity }]);
    });

    it('reports the fallback on the chunk, so the decoder never consults the plan for it', () => {
        const subject = plan(['id', 'float64']);
        const { chunks } = roundTrip(subject, [['text']]);

        expect(subject.columns[0].encoding).toBe('float64');
        expect(chunks[0].columns.id.encoding).toBe('clone');
    });

    it('carries a null already written into the fallback array', () => {
        const { rows } = roundTrip(plan(['id', 'float64']), [[null], [1], ['text']]);

        expect(rows).toEqual([{ id: null }, { id: 1 }, { id: 'text' }]);
    });

    it('emits Dates for the rows a date column had already written before falling back', () => {
        // The ISO text of those rows is gone, and a Date is what the decoder would have emitted.
        // An epoch number would reach the entity as a number, since the date deserializer only
        // converts strings.
        const junk = { nope: true };
        const { rows } = roundTrip(plan(['at', 'date-f64']), [['2026-08-25T00:00:00.000Z'], [junk]]);

        expect(rows).toEqual([{ at: new Date('2026-08-25T00:00:00.000Z') }, { at: junk }]);
    });

    it('sends an unparseable date to clone', () => {
        const { rows, chunks } = roundTrip(plan(['at', 'date-f64']), [['not a date']]);

        expect(chunks[0].columns.at.encoding).toBe('clone');
        expect(rows).toEqual([{ at: 'not a date' }]);
    });

    it('stays on clone for every later chunk once a column has fallen back', () => {
        const rows: unknown[][] = [['text']];

        for (let i = 0; i < CHUNK_ROWS; i++) {
            rows.push([i]);
        }

        const { chunks } = roundTrip(plan(['id', 'float64']), rows);

        expect(chunks).toHaveLength(2);
        expect(chunks[0].columns.id.encoding).toBe('clone');
        expect(chunks[1].columns.id.encoding).toBe('clone');
    });

    it('accepts booleans as well as the 0 and 1 an engine with no boolean type returns', () => {
        const { rows, chunks } = roundTrip(plan(['flag', 'boolean-byte']), [[1], [0], [true], [false]]);

        expect(chunks[0].columns.flag.encoding).toBe('boolean-byte');
        expect(rows).toEqual([{ flag: true }, { flag: false }, { flag: true }, { flag: false }]);
    });

    it('sends a boolean column holding some other number to clone', () => {
        const { rows, chunks } = roundTrip(plan(['flag', 'boolean-byte']), [[1], [2]]);

        expect(chunks[0].columns.flag.encoding).toBe('clone');
        expect(rows).toEqual([{ flag: 1 }, { flag: 2 }]);
    });

    it('sends a json column holding a non-string to clone', () => {
        const { rows, chunks } = roundTrip(plan(['meta', 'json']), [['{"a":1}'], [42]]);

        expect(chunks[0].columns.meta.encoding).toBe('clone');
        expect(rows).toEqual([{ meta: '{"a":1}' }, { meta: 42 }]);
    });

    it('carries a null a json column had already written as null, not as the text null', () => {
        // The document holds the four characters `null` for a SQL NULL. Draining that text into a
        // clone column would decode to the STRING 'null', while every row after the fallback
        // decodes to a real null — one column, two answers for the same value.
        const { rows } = roundTrip(plan(['meta', 'json']), [[null], ['{"a":1}'], [42]]);

        expect(rows).toEqual([{ meta: null }, { meta: '{"a":1}' }, { meta: 42 }]);
    });
});

/**
 * The codec must not assume an engine that returns raw stored text and numbers.
 *
 * A store that parses before returning — a document store, a key-value store holding decoded
 * records, a driver with type parsers — hands back real `Date` objects, real booleans and live
 * objects. Requiring the raw shape would silently drop the encoding for every such engine: every
 * row would fall back to `clone` and the codec would do nothing.
 */
describe('engines that return parsed values', () => {

    it('takes a real Date in a date column', () => {
        const when = new Date('2026-08-25T12:34:56.789Z');
        const { rows, chunks } = roundTrip(plan(['at', 'date-f64']), [[when]]);

        expect(chunks[0].columns.at.encoding).toBe('date-f64');
        expect(rows).toEqual([{ at: when }]);
    });

    it('takes an epoch number in a date column', () => {
        const { rows, chunks } = roundTrip(plan(['at', 'date-f64']), [[1756118096789]]);

        expect(chunks[0].columns.at.encoding).toBe('date-f64');
        expect(rows).toEqual([{ at: new Date(1756118096789) }]);
    });

    it('mixes the three date shapes in one column without falling back', () => {
        const iso = '2026-08-25T00:00:00.000Z';
        const { rows, chunks } = roundTrip(plan(['at', 'date-f64']), [
            [iso], [new Date(iso)], [Date.parse(iso)], [null],
        ]);

        expect(chunks[0].columns.at.encoding).toBe('date-f64');
        expect(rows).toEqual([
            { at: new Date(iso) }, { at: new Date(iso) }, { at: new Date(iso) }, { at: null },
        ]);
    });

    it('sends an invalid Date to clone rather than writing NaN', () => {
        const invalid = new Date('not a date');
        const { rows, chunks } = roundTrip(plan(['at', 'date-f64']), [[invalid]]);

        expect(chunks[0].columns.at.encoding).toBe('clone');
        expect(rows).toEqual([{ at: invalid }]);
    });

    it('stringifies a live object for the one-parse-per-chunk path', () => {
        const { rows, chunks } = roundTrip(plan(['meta', 'json-stringify']), [
            [{ a: 1, b: [2, 3] }], [null], [{ a: 2, b: [] }],
        ]);

        // Crosses as an ordinary json column, so it needs no decoder of its own.
        expect(chunks[0].columns.meta.encoding).toBe('json');
        expect(rows).toEqual([{ meta: { a: 1, b: [2, 3] } }, { meta: null }, { meta: { a: 2, b: [] } }]);
    });

    it('sends a value JSON cannot represent to clone instead of throwing', () => {
        const circular: Record<string, unknown> = { a: 1 };
        circular.self = circular;

        const { rows, chunks } = roundTrip(plan(['meta', 'json-stringify']), [[{ ok: true }], [circular]]);

        // Compared to a boolean rather than passed into `toEqual`: a circular structure in an
        // assertion payload cannot be serialised back to the jest parent process.
        const carriedUnchanged = (rows[1] as Record<string, unknown>).meta === circular;

        expect(chunks[0].columns.meta.encoding).toBe('clone');
        expect(carriedUnchanged).toBe(true);
        expect((rows[0] as Record<string, unknown>).meta).toEqual({ ok: true });
    });

    it('sends a bigint in a json-stringify column to clone, which JSON.stringify throws on', () => {
        const big = BigInt(7);
        const { rows, chunks } = roundTrip(plan(['meta', 'json-stringify']), [[big]]);

        expect(chunks[0].columns.meta.encoding).toBe('clone');
        expect(rows).toEqual([{ meta: big }]);
    });
});

describe('appendRecord', () => {

    /** For an engine that yields records rather than positional tuples. */
    const fromRecords = (subject: TransferPlan, records: Record<string, unknown>[]) => {
        const encoder = new ChunkEncoder(subject);

        records.forEach(record => encoder.appendRecord(record));

        return decodeChunk(subject, encoder.take().payload);
    };

    it('reads each planned field out of the record by name', () => {
        const subject = plan(['id', 'float64'], ['name', 'clone'], ['at', 'date-f64']);
        const when = new Date('2026-08-25T00:00:00.000Z');

        expect(fromRecords(subject, [{ id: 1, name: 'ada', at: when }]))
            .toEqual([{ id: 1, name: 'ada', at: when }]);
    });

    it('ignores fields the plan does not name', () => {
        const subject = plan(['id', 'float64']);

        expect(fromRecords(subject, [{ id: 1, extra: 'ignored' }])).toEqual([{ id: 1 }]);
    });

    /** Records are legitimately heterogeneous outside a fixed-schema table. */
    it('reads a field the record does not carry as null', () => {
        const subject = plan(['id', 'float64'], ['nickname', 'clone']);

        expect(fromRecords(subject, [{ id: 1 }, { id: 2, nickname: 'ada' }]))
            .toEqual([{ id: 1, nickname: null }, { id: 2, nickname: 'ada' }]);
    });

    it('keeps plan order regardless of the order the record declares its fields in', () => {
        const subject = plan(['a', 'float64'], ['b', 'clone']);
        const rows = fromRecords(subject, [{ b: 'x', a: 1 }]);

        expect(Object.keys(rows[0] as object)).toEqual(['a', 'b']);
        expect(rows[0]).toEqual({ a: 1, b: 'x' });
    });

    /**
     * `record['toString']` answers with a function and `record['__proto__']` with
     * `Object.prototype`, so a plain read would encode an inherited value as data.
     */
    it.each(['__proto__', 'toString', 'constructor'])('reads an absent %s field as null, not as an inherited value', (name) => {
        const subject = plan([name, 'clone'], ['id', 'float64']);
        const rows = fromRecords(subject, [{ id: 1 }]);
        const row = rows[0] as Record<string, unknown>;

        expect(row[name]).toBeNull();
        expect(row.id).toBe(1);
    });

    it('reads a field the record really does carry under one of those names', () => {
        const subject = plan(['toString', 'clone']);

        expect(fromRecords(subject, [{ toString: 'carried' }])).toEqual([{ toString: 'carried' }]);
    });
});

describe('json documents', () => {

    it('parses one document per column per chunk', () => {
        const { rows, chunks } = roundTrip(plan(['meta', 'json']), [['{"a":1}'], ['[2]'], ['"three"'], ['null']]);

        expect((chunks[0].columns.meta as { doc: string }).doc).toBe('[{"a":1},[2],"three",null]');
        expect(rows).toEqual([{ meta: { a: 1 } }, { meta: [2] }, { meta: 'three' }, { meta: null }]);
    });

    it('emits an empty document for a zero-row result', () => {
        const { chunks } = roundTrip(plan(['meta', 'json']), []);

        expect((chunks[0].columns.meta as { doc: string }).doc).toBe('[]');
    });

    it('keeps a comma inside a string from splitting the document', () => {
        const { rows } = roundTrip(plan(['meta', 'json']), [['{"a":"x,y"}'], ['{"b":"]"}']]);

        expect(rows).toEqual([{ meta: { a: 'x,y' } }, { meta: { b: ']' } }]);
    });

    it('reports the column when the document does not parse, so the caller can retry planless', () => {
        const subject = plan(['meta', 'json'], ['id', 'float64']);
        const encoder = new ChunkEncoder(subject);

        encoder.appendRow(['this is not json', 1]);

        let thrown: unknown;

        try {
            decodeChunk(subject, encoder.take().payload);
        } catch (error) {
            thrown = error;
        }

        expect(isTransferJsonError(thrown)).toBe(true);
        expect((thrown as { transferJsonColumn: string }).transferJsonColumn).toBe('meta');
    });

    it('does not classify an ordinary decode failure as a json error', () => {
        expect(isTransferJsonError(new Error('something else'))).toBe(false);
        expect(isTransferJsonError(null)).toBe(false);
    });
});

describe('versions', () => {

    it('refuses a chunk whose version this build does not know', () => {
        const subject = plan(['id', 'float64']);
        const { chunks } = roundTrip(subject, [[1]]);
        const future = { ...chunks[0], version: 2 } as unknown as EncodedChunk;

        expect(() => decodeChunk(subject, future)).toThrow('transfer codec version 2 is not supported');
    });

    it('refuses a plan whose version this build does not know', () => {
        const future = { version: 9, columns: [{ name: 'id', encoding: 'float64' }] } as unknown as TransferPlan;

        expect(() => new ChunkEncoder(future)).toThrow('transfer codec version 9 is not supported');
    });
});

describe('the decoder cache', () => {

    it('reuses one compiled decoder for two results of the same shape', () => {
        const first = plan(['id', 'float64'], ['name', 'clone']);
        const second = plan(['id', 'float64'], ['name', 'clone']);

        expect(roundTrip(first, [[1, 'a']]).rows).toEqual([{ id: 1, name: 'a' }]);
        expect(roundTrip(second, [[2, 'b']]).rows).toEqual([{ id: 2, name: 'b' }]);
    });

    it('does not share a decoder between two shapes that differ only by encoding', () => {
        // The same collection after a migration changes a column's type. A collection-keyed
        // cache would decode the new shape with the old layout and report nothing.
        const before = plan(['value', 'clone']);
        const after = plan(['value', 'float64']);

        expect(roundTrip(before, [['1']]).rows).toEqual([{ value: '1' }]);
        expect(roundTrip(after, [[1]]).rows).toEqual([{ value: 1 }]);
    });

    it('does not share a decoder between two shapes that differ only by column order', () => {
        expect(roundTrip(plan(['a', 'float64'], ['b', 'clone']), [[1, 'x']]).rows).toEqual([{ a: 1, b: 'x' }]);
        expect(roundTrip(plan(['b', 'clone'], ['a', 'float64']), [['x', 1]]).rows).toEqual([{ b: 'x', a: 1 }]);
    });

    it('keeps decoding correctly past its capacity', () => {
        for (let i = 0; i < 80; i++) {
            const subject = plan([`c${i}`, 'float64']);

            expect(roundTrip(subject, [[i]]).rows).toEqual([{ [`c${i}`]: i }]);
        }
    });

    it('does not collide two layouts whose names contain the key separators', () => {
        const first = plan(['a|b:float64', 'clone'], ['c', 'float64']);
        const second = plan(['a', 'clone'], ['b:float64|c', 'float64']);

        expect(roundTrip(first, [['x', 1]]).rows).toEqual([{ 'a|b:float64': 'x', c: 1 }]);
        expect(roundTrip(second, [['x', 1]]).rows).toEqual([{ a: 'x', 'b:float64|c': 1 }]);
    });
});

describe('rejected layouts', () => {

    it('refuses a plan naming one column twice, which a chunk cannot carry', () => {
        expect(() => new ChunkEncoder(plan(['id', 'float64'], ['id', 'clone']))).toThrow(/more than once/);
    });

    it('refuses a plan with no columns', () => {
        expect(() => new ChunkEncoder(plan())).toThrow(/at least one column/);
    });

    it('refuses a row whose value count does not match the plan', () => {
        const encoder = new ChunkEncoder(plan(['a', 'float64'], ['b', 'clone']));

        expect(() => encoder.appendRow([1])).toThrow(/1 values for 2 planned columns/);
    });

    it('refuses to decode a chunk missing a planned column', () => {
        const subject = plan(['id', 'float64'], ['name', 'clone']);
        const { chunks } = roundTrip(subject, [[1, 'a']]);
        const missing = { ...chunks[0], columns: { id: chunks[0].columns.id } };

        expect(() => decodeChunk(subject, missing)).toThrow(/no column 'name'/);
    });
});

describe('assertColumnLayout', () => {

    it('accepts the columns the plan describes, in order', () => {
        expect(() => assertColumnLayout(plan(['a', 'float64'], ['b', 'clone']), ['a', 'b'])).not.toThrow();
    });

    it('refuses a different order, which would file every column under another name', () => {
        expect(() => assertColumnLayout(plan(['a', 'float64'], ['b', 'clone']), ['b', 'a'])).toThrow(/does not match/);
    });

    it('refuses a result carrying a column the plan does not list', () => {
        expect(() => assertColumnLayout(plan(['a', 'float64']), ['a', 'b'])).toThrow(/does not match/);
    });

    it('names both layouts, because the mismatch is the whole message', () => {
        expect(() => assertColumnLayout(plan(['a', 'float64']), ['b'])).toThrow(/Plan: \[a\]\. Result: \[b\]\./);
    });
});

describe('generated functions', () => {

    it('reports whether this environment allows them at all', () => {
        // Node always does. The value is what a driver reads once at startup to decide whether
        // to send plans; a Content-Security-Policy without `unsafe-eval` makes it false.
        expect(isTransferCodecSupported()).toBe(true);
    });
});
