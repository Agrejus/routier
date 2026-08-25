/**
 * The wire format for query results crossing an in-process worker boundary.
 *
 * `postMessage` with no transfer list structured-clones everything, and a clone of a large row
 * array is paid twice — once serialising in the worker, once deserialising on the main thread,
 * where it blocks. Columnar typed arrays are transferred instead: the buffer changes owner and
 * nothing is copied.
 *
 * Nothing here knows about SQL, schemas, or workers. A column's values go in and
 * `{ payload, transferables }` comes out; the caller owns the transport. A transport with no
 * transfer list may ignore the array — the payload then clones correctly on its own.
 */

/**
 * The COMPLETE layout: chunk size, bitmap semantics, JSON joining, and the framing above.
 *
 * Both sides reject a version they do not know rather than guessing. The worker ships as its own
 * bundle, so the two halves can be built from different sources.
 */
export const TRANSFER_VERSION = 1;

/**
 * Rows per chunk.
 *
 * Chunking is what lets the main thread decode chunk *k* while the worker fills *k+1*, so the
 * first rows arrive in about 2ms at any result size instead of after the whole clone. Measured
 * best at 4,096: 8,192 is within noise, 25,000 is measurably worse.
 */
export const CHUNK_ROWS = 4096;

/**
 * How one result column crosses the boundary.
 *
 * Each encoding names a VALUE shape, never an engine. An engine that hands back a date as ISO
 * text and one that hands back a `Date` both use `date-f64`; the filler accepts either. What an
 * engine cannot produce, it simply does not choose.
 */
export type TransferEncoding =
    /** `Float64Array` + null bitmap, transferred. */
    | 'float64'
    /**
     * Epoch ms in a `Float64Array` + null bitmap, transferred.
     *
     * Accepts a `Date`, an epoch number, or a parseable date string — whichever the engine
     * returns. Decode emits a `Date`.
     */
    | 'date-f64'
    /** `Uint8Array` of 0/1 + null bitmap, transferred; accepts 0/1 or a boolean; decode emits `true`/`false`. */
    | 'boolean-byte'
    /**
     * Values that are ALREADY JSON text, joined into ONE document per chunk; decode parses once.
     *
     * For an engine that stores a nested structure as text and returns it that way.
     */
    | 'json'
    /**
     * Values that are live objects, `JSON.stringify`d as they are collected, then joined and
     * parsed like `json`.
     *
     * For an engine that returns a nested structure already parsed — a document store, or a
     * driver with a JSON type parser. Crosses the wire as a `json` column, so it needs no
     * separate decoder.
     *
     * Whether this beats `clone` for a given payload is NOT measured. What was measured is that
     * once a value IS text, crossing it as text and parsing once per chunk beats parsing in the
     * worker and cloning the tree (25.3ms against 38.5ms at 20,000 rows). Deep, repetitive
     * structures are the promising case; a small flat object is likely a wash.
     */
    | 'json-stringify'
    /** Plain array of raw values, structured-cloned as they are. */
    | 'clone';

export type TransferColumn = {
    /** Exact name the engine returns, including projection and join aliases. */
    readonly name: string;
    readonly encoding: TransferEncoding;
};

export type TransferPlan = {
    readonly version: typeof TRANSFER_VERSION;
    readonly columns: readonly TransferColumn[];
};

export type EncodedColumn =
    | { readonly encoding: 'float64'; readonly data: Float64Array; readonly nulls: Uint8Array }
    | { readonly encoding: 'date-f64'; readonly data: Float64Array; readonly nulls: Uint8Array }
    | { readonly encoding: 'boolean-byte'; readonly data: Uint8Array; readonly nulls: Uint8Array }
    /** `'[' + rowTexts.join(',') + ']'`; a null row contributes the text `null`. */
    | { readonly encoding: 'json'; readonly doc: string }
    | { readonly encoding: 'clone'; readonly data: readonly unknown[] };

export type EncodedChunk = {
    readonly version: typeof TRANSFER_VERSION;
    /**
     * Rows in THIS chunk. The final chunk may be short, and is only 0 for the single chunk of a
     * zero-row result.
     */
    readonly rowCount: number;
    /** Keyed by column name. Exactly one entry per plan column. */
    readonly columns: Record<string, EncodedColumn>;
};

/**
 * One chunk and the buffers its transport may hand over rather than copy.
 *
 * The list is separate from the payload on purpose — it is an instruction to the transport, not
 * data, and embedding it would make the payload describe its own framing.
 */
export type EncodedTransfer = {
    readonly payload: EncodedChunk;
    readonly transferables: readonly ArrayBufferLike[];
};

/** Bytes of null bitmap for `rowCount` rows: one bit per row, LSB-first. */
export const nullByteLength = (rowCount: number): number => (rowCount + 7) >> 3;

/**
 * Rejects a version this build cannot read.
 *
 * Never attempt to decode an unknown version. Every field's meaning is version-scoped, so a
 * layout that merely looks close would be read wrongly and silently.
 */
export const assertTransferVersion = (version: number): void => {
    if (version !== TRANSFER_VERSION) {
        throw new Error(`transfer codec version ${version} is not supported`);
    }
};

/**
 * Rejects a plan that does not describe the result the engine is about to produce.
 *
 * OPTIONAL, for an engine that can report the fields of a result before yielding rows. Encoding
 * against a wrong layout would put each field's values under another field's name and report
 * nothing, so a caller that CAN check should. An engine whose records are heterogeneous has
 * nothing to check against and skips it — the plan decides the result shape there.
 *
 * Checked once per result, never per row.
 */
export const assertColumnLayout = (plan: TransferPlan, names: readonly string[]): void => {
    const planned = plan.columns.map(column => column.name);

    const matches = planned.length === names.length
        && planned.every((name, index) => name === names[index]);

    if (matches === false) {
        throw new Error(
            `The transfer plan does not match the result columns. ` +
            `Plan: [${planned.join(', ')}]. Result: [${names.join(', ')}].`
        );
    }
};
