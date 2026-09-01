import { ColumnFiller, CloneFiller, createFiller } from './fillers';
import {
    assertTransferVersion,
    CHUNK_ROWS,
    EncodedColumn,
    EncodedTransfer,
    TransferColumn,
    TransferPlan,
    TRANSFER_VERSION,
} from './types';

/** Probe for names the prototype chain answers for — `__proto__`, `toString`, `constructor`. */
const EMPTY_OBJECT: Record<string, unknown> = {};

/**
 * Fills one chunk at a time from row values, and emits it with the buffers its transport can hand
 * over.
 *
 * One encoder per result, not per chunk: a column that falls back to `clone` stays there for
 * every later chunk, and a forward-only cursor cannot rewind to re-encode what it already yielded.
 *
 * Usage is a loop — `appendRow` or `appendRecord` until `isFull`, `take`, repeat, then `take` once
 * more for the short final chunk. A zero-row result takes exactly one chunk with `rowCount: 0`.
 */
export class ChunkEncoder {

    private readonly columns: readonly TransferColumn[];
    private readonly fillers: ColumnFiller[];
    private readonly inheritedNames: boolean;
    private rows = 0;

    constructor(plan: TransferPlan) {
        assertTransferVersion(plan.version);

        if (plan.columns.length === 0) {
            throw new Error('A transfer plan needs at least one column; a result with no columns has no rows to encode.');
        }

        const names = new Set<string>();

        for (const column of plan.columns) {
            if (names.has(column.name)) {
                // One entry per column name in the emitted chunk, so two columns sharing a name
                // would silently keep only the second. The caller aliases them instead.
                throw new Error(`A transfer plan names the column '${column.name}' more than once.`);
            }

            names.add(column.name);
        }

        this.columns = plan.columns;
        this.fillers = plan.columns.map(column => createFiller(column.encoding));
        this.inheritedNames = plan.columns.some(column => column.name in EMPTY_OBJECT);
    }

    /** Rows in the chunk being filled. */
    get rowCount(): number {
        return this.rows;
    }

    get isFull(): boolean {
        return this.rows === CHUNK_ROWS;
    }

    /** The column names, in the order a row's values must arrive in. */
    get columnNames(): readonly string[] {
        return this.columns.map(column => column.name);
    }

    /**
     * Adds one row, its values in plan column order.
     *
     * A value that does not belong in its column's encoding sends that column to `clone` for the
     * rest of the result, carrying the rows already written with it. Nothing is coerced into a
     * typed array.
     */
    appendRow(values: readonly unknown[]): void {
        if (this.isFull) {
            throw new Error(`The chunk is full at ${CHUNK_ROWS} rows; take it before appending another.`);
        }

        if (values.length !== this.fillers.length) {
            throw new Error(
                `A row carried ${values.length} values for ${this.fillers.length} planned columns.`
            );
        }

        const index = this.rows;

        for (let i = 0; i < this.fillers.length; i++) {
            if (this.fillers[i].set(index, values[i]) === false) {
                this.fallBack(i, index, values[i]);
            }
        }

        this.rows = index + 1;
    }

    /**
     * Adds one row from a NAME-KEYED record, reading each planned column out of it.
     *
     * For an engine that yields records rather than positional tuples — a document store, a
     * key-value store, a driver that returns row objects. Projecting to an array is the caller's
     * alternative, and getting that order wrong is silent corruption rather than an error, so the
     * mapping belongs here once instead of in every plugin.
     *
     * A column the record does not carry is `null`, not an error. Records are legitimately
     * heterogeneous outside a fixed-schema table, and the plan is what decides the result shape.
     */
    appendRecord(record: Record<string, unknown>): void {
        const values: unknown[] = new Array(this.columns.length);

        for (let i = 0; i < this.columns.length; i++) {
            values[i] = this.readField(record, this.columns[i].name);
        }

        this.appendRow(values);
    }

    /**
     * A plain read, unless a planned name is one the prototype chain answers for.
     *
     * `record['__proto__']` on an object literal returns `Object.prototype` rather than
     * `undefined`, and `toString` returns a function — either would be encoded as a value. The
     * own-property test that avoids it costs a call per field, so it is only taken when a name in
     * this plan actually needs it.
     */
    private readField(record: Record<string, unknown>, name: string): unknown {
        if (this.inheritedNames) {
            return Object.prototype.hasOwnProperty.call(record, name) ? record[name] : null;
        }

        const value = record[name];

        // `null`, not `undefined`. An absent field and one holding `undefined` mean the same thing
        // here, and a `clone` column would otherwise carry `undefined` all the way to the entity —
        // a decoded row says `null` for an absent value in every other encoding.
        return value === undefined ? null : value;
    }

    /**
     * Emits the filled chunk and readies the encoder for the next one.
     *
     * Transfer DETACHES the emitted buffers, so the fillers allocate fresh arrays here rather
     * than reusing them. Reading a chunk's typed arrays after this is a use-after-transfer.
     */
    take(): EncodedTransfer {
        const transferables: ArrayBufferLike[] = [];
        // `Object.create(null)`, because a column named `__proto__` assigned onto a plain object
        // reaches `Object.prototype`'s setter and never becomes an own property — the column then
        // survives same-realm through the getter and vanishes the moment the chunk is cloned.
        const columns = Object.create(null) as Record<string, EncodedColumn>;

        for (let i = 0; i < this.columns.length; i++) {
            columns[this.columns[i].name] = this.fillers[i].emit(this.rows, transferables);
        }

        const payload = { version: TRANSFER_VERSION, rowCount: this.rows, columns } as const;

        this.rows = 0;

        for (const filler of this.fillers) {
            filler.reset();
        }

        return { payload, transferables };
    }

    private fallBack(column: number, index: number, value: unknown): void {
        const clone = new CloneFiller(this.fillers[column].drain(index));

        clone.set(index, value);

        this.fillers[column] = clone;
    }
}
