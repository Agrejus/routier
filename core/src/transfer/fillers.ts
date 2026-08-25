import { CHUNK_ROWS, EncodedColumn, nullByteLength, TransferEncoding } from './types';

/**
 * One column being filled, one strategy per encoding.
 *
 * `set` answers `false` rather than coercing a value that does not belong in its encoding. A
 * schema type does not prove what an engine will actually return — custom serializers,
 * migrations and external writers can put anything in a field — so the encoder validates every
 * value it writes instead of trusting the plan. The caller turns a refusal into a fallback to
 * `clone`.
 */
export interface ColumnFiller {
    readonly encoding: TransferEncoding;
    set(index: number, value: unknown): boolean;
    /** Rows `0..count` as raw values, which is what a fallback to `clone` has to carry forward. */
    drain(count: number): unknown[];
    emit(rowCount: number, transferables: ArrayBufferLike[]): EncodedColumn;
    /** Readies the filler for the next chunk. Transfer detaches the buffers, so they are replaced. */
    reset(): void;
}

const NULL_BYTES = nullByteLength(CHUNK_ROWS);

/**
 * Epoch milliseconds for any shape an engine returns a date in, or `null` for anything else.
 *
 * An invalid `Date` and an unparseable string both answer `null` rather than writing `NaN`: a
 * date that cannot be represented is a value this encoding has no answer for, and the column
 * falls back so the raw value survives.
 */
const toEpoch = (value: unknown): number | null => {
    if (value instanceof Date) {
        const epoch = value.getTime();

        return Number.isNaN(epoch) ? null : epoch;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? null : parsed;
};

abstract class TypedFiller<TData extends Float64Array | Uint8Array> implements ColumnFiller {

    abstract readonly encoding: TransferEncoding;

    protected data: TData;
    protected nulls: Uint8Array;

    constructor() {
        this.data = this.allocate();
        this.nulls = new Uint8Array(NULL_BYTES);
    }

    protected abstract allocate(): TData;

    /** Writes a non-null value, or answers false to send the column to `clone`. */
    protected abstract write(index: number, value: unknown): boolean;

    /** The value a `clone` fallback should carry for an already-written row. */
    protected abstract raw(index: number): unknown;

    set(index: number, value: unknown): boolean {
        if (value == null) {
            this.nulls[index >> 3] |= 1 << (index & 7);
            this.data[index] = 0;
            return true;
        }

        return this.write(index, value);
    }

    drain(count: number): unknown[] {
        const values: unknown[] = new Array(count);

        for (let i = 0; i < count; i++) {
            const isNull = (this.nulls[i >> 3] & (1 << (i & 7))) !== 0;

            values[i] = isNull ? null : this.raw(i);
        }

        return values;
    }

    emit(rowCount: number, transferables: ArrayBufferLike[]): EncodedColumn {
        // `subarray` would not do: transfer moves the whole underlying buffer, so a short final
        // chunk has to be copied to its exact size. A full chunk is already exact.
        const data = (rowCount === CHUNK_ROWS ? this.data : this.data.slice(0, rowCount)) as TData;
        const nulls = rowCount === CHUNK_ROWS ? this.nulls : this.nulls.slice(0, nullByteLength(rowCount));

        transferables.push(data.buffer, nulls.buffer);

        return { encoding: this.encoding, data, nulls } as EncodedColumn;
    }

    reset(): void {
        this.data = this.allocate();
        this.nulls = new Uint8Array(NULL_BYTES);
    }
}

/**
 * Numbers, including `NaN` and the infinities — those are legitimate JS numbers and pass through.
 *
 * No `BigInt64Array`. Routier only ever writes JS numbers, so `Float64Array` round-trips
 * everything it stored; a `bigint` or a wide integer type can only come from something else, and
 * that column falls back rather than losing precision silently.
 */
class Float64Filler extends TypedFiller<Float64Array> {

    readonly encoding = 'float64' as const;

    protected allocate(): Float64Array {
        return new Float64Array(CHUNK_ROWS);
    }

    protected write(index: number, value: unknown): boolean {
        if (typeof value !== 'number') {
            return false;
        }

        this.data[index] = value;

        return true;
    }

    protected raw(index: number): unknown {
        return this.data[index];
    }
}

/**
 * Epoch milliseconds, whatever shape the engine returned the date in.
 *
 * All three shapes are accepted because engines genuinely differ: one that stores a date as text
 * returns a string, one that parses before returning gives a `Date`, and one that stores a
 * timestamp gives a number. Requiring text would silently drop the whole encoding for every
 * engine of the other two kinds — they would fall back to `clone` on every row.
 *
 * The final entity shape needs a `Date` either way, so converting here means the wire carries
 * eight bytes and the main thread builds the `Date` from them.
 */
class DateFiller extends TypedFiller<Float64Array> {

    readonly encoding = 'date-f64' as const;

    protected allocate(): Float64Array {
        return new Float64Array(CHUNK_ROWS);
    }

    protected write(index: number, value: unknown): boolean {
        const epoch = toEpoch(value);

        if (epoch == null) {
            return false;
        }

        this.data[index] = epoch;

        return true;
    }

    /**
     * A `Date`, not the epoch number.
     *
     * A fallback column is decoded raw, and the rows already written can no longer produce their
     * ISO text. A `Date` is what the decoder would have emitted for them, and it is also what
     * the existing date deserializer passes through untouched — an epoch number would reach the
     * entity as a number.
     */
    protected raw(index: number): unknown {
        return new Date(this.data[index]);
    }
}

/**
 * 0/1 bytes.
 *
 * Both shapes are accepted: an engine with no boolean type returns 0 or 1, one with a boolean
 * type returns a boolean. Requiring either would drop the encoding entirely for engines of the
 * other kind. Both decode to `true`/`false`, so the result is identical.
 */
class BooleanFiller extends TypedFiller<Uint8Array> {

    readonly encoding = 'boolean-byte' as const;

    protected allocate(): Uint8Array {
        return new Uint8Array(CHUNK_ROWS);
    }

    protected write(index: number, value: unknown): boolean {
        if (value === 0 || value === 1) {
            this.data[index] = value;
            return true;
        }

        if (typeof value !== 'boolean') {
            return false;
        }

        this.data[index] = value ? 1 : 0;

        return true;
    }

    protected raw(index: number): unknown {
        return this.data[index];
    }
}

/**
 * JSON text, joined into one document per chunk so the main thread parses once per column
 * instead of once per row.
 *
 * The join is valid because each element is a complete JSON document and `null` is valid JSON.
 * The text is NOT validated here; that would be the second parse this exists to avoid. Text that
 * is not JSON poisons the chunk's document and the decoder reports it (see `decodeChunk`).
 */
class JsonFiller implements ColumnFiller {

    readonly encoding = 'json' as const;

    private texts: string[] = [];

    /**
     * Which rows were null, so a fallback to `clone` can carry `null` rather than the text
     * `'null'` the document holds. Sparse — only null rows are written.
     */
    private nulls: boolean[] = [];

    /**
     * @param toText The JSON text for one non-null value, or `null` to send the column to
     * `clone`. This is the whole difference between an engine that returns text and one that
     * returns a live object.
     * @param fromText Recovers the value the engine originally gave, for a fallback to `clone`.
     * The stored text is all that is kept, so a filler whose input was NOT text has to reverse
     * its own conversion — otherwise the rows written before the fallback would change type,
     * coming back as text while every row after it comes back as an object.
     */
    constructor(
        private readonly toText: (value: unknown) => string | null,
        private readonly fromText: (text: string) => unknown
    ) { }

    set(index: number, value: unknown): boolean {
        if (value == null) {
            this.texts[index] = 'null';
            this.nulls[index] = true;
            return true;
        }

        const text = this.toText(value);

        if (text == null) {
            return false;
        }

        this.texts[index] = text;

        return true;
    }

    drain(count: number): unknown[] {
        const values: unknown[] = new Array(count);

        for (let i = 0; i < count; i++) {
            values[i] = this.nulls[i] === true ? null : this.fromText(this.texts[i]);
        }

        return values;
    }

    emit(rowCount: number): EncodedColumn {
        // Joined with a single ',' and nothing else, which is the whole of the format.
        const doc = `[${this.texts.slice(0, rowCount).join(',')}]`;

        return { encoding: this.encoding, doc };
    }

    reset(): void {
        this.texts = [];
        this.nulls = [];
    }
}

/**
 * Raw values in a plain array, structured-cloned as they are.
 *
 * Strings live here and are never encoded. `TextEncoder` loses to clone by a wide margin —
 * 14.0ms against 8.3ms for 4,000 rows of 2KB text — because cloning a V8 string is a native
 * memcpy.
 */
export class CloneFiller implements ColumnFiller {

    readonly encoding = 'clone' as const;

    private data: unknown[];

    constructor(seed: unknown[] = []) {
        this.data = seed;
    }

    set(index: number, value: unknown): boolean {
        this.data[index] = value;

        return true;
    }

    drain(count: number): unknown[] {
        return this.data.slice(0, count);
    }

    emit(rowCount: number): EncodedColumn {
        return { encoding: this.encoding, data: this.data.slice(0, rowCount) };
    }

    reset(): void {
        this.data = [];
    }
}

/** A value that is already JSON text is passed straight through; anything else is not text. */
const asJsonText = (value: unknown): string | null =>
    typeof value === 'string' ? value : null;

/**
 * A live value becomes text here.
 *
 * `JSON.stringify` throws on a circular structure and on a `bigint`, and returns `undefined` for
 * a value that is not representable at all — a function, or a lone `undefined`. All three send the
 * column to `clone`, which is the same answer every other filler gives a value it cannot encode.
 */
const asStringifiedJson = (value: unknown): string | null => {
    try {
        return JSON.stringify(value) ?? null;
    } catch {
        return null;
    }
};

/**
 * Back to a value, for a `json-stringify` column that fell back.
 *
 * The text came from `JSON.stringify` on this same value, so it parses. A `catch` returning the
 * text is there only so a fallback — already the unhappy path — cannot throw.
 */
const parseJsonText = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

const FILLERS: Record<TransferEncoding, () => ColumnFiller> = {
    'float64': () => new Float64Filler(),
    'date-f64': () => new DateFiller(),
    'boolean-byte': () => new BooleanFiller(),
    // The engine gave text, so the text IS the raw value a fallback should carry.
    'json': () => new JsonFiller(asJsonText, text => text),
    // The engine gave a live object, so a fallback has to parse the text back into one.
    'json-stringify': () => new JsonFiller(asStringifiedJson, parseJsonText),
    'clone': () => new CloneFiller(),
};

export const createFiller = (encoding: TransferEncoding): ColumnFiller => {
    const create = FILLERS[encoding];

    if (create == null) {
        throw new Error(`transfer encoding '${encoding}' is not supported`);
    }

    return create();
};
