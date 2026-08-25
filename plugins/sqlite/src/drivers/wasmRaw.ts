/**
 * Reading column values through SQLite's raw WASM exports.
 *
 * sqlite-wasm's `Stmt.get(i)` costs three WRAPPED calls per value: a redundant
 * `sqlite3_column_count` to bounds-check the index, a `sqlite3_column_type` to sniff the type, and
 * the fetch itself. Each wrapped call allocates a rest array and an allocation scope, dispatches
 * argument and result adapters through Maps, then splices the scope back off. Integers also
 * round-trip through `BigInt`. For a 4,000-row six-column read that is about 64,000 wrapped calls,
 * and it measured as three quarters of the whole read — far more than moving the rows across the
 * worker boundary ever cost.
 *
 * The same values read straight from `wasm.exports` measured 3.2x faster, NULL handling included.
 *
 * Split in two on purpose: `RawSqlite` is the small surface the reading logic needs, and
 * `rawSqliteFrom` is the only part that touches sqlite-wasm internals. The logic is unit-testable
 * against a fake; the glue is verified by the browser harness, which is the only place a real
 * WASM heap exists.
 */

/** Result codes and column types, from sqlite3.h. */
const SQLITE_ROW = 100;
const SQLITE_INTEGER = 1;
const SQLITE_FLOAT = 2;
const SQLITE_TEXT = 3;
const SQLITE_BLOB = 4;
const SQLITE_NULL = 5;

/** What reading a result needs from SQLite, with nothing else attached. */
export type RawSqlite = {
    /** True while a row is available. */
    step(statement: number): boolean;
    columnType(statement: number, column: number): number;
    columnDouble(statement: number, column: number): number;
    /** Only for an integer too large to survive as a double. */
    columnBigInt(statement: number, column: number): bigint;
    text(statement: number, column: number): string;
    blob(statement: number, column: number): Uint8Array;
};

/**
 * One value, matching what sqlite-wasm's own `Stmt.get` returns for each storage class.
 *
 * The type is read first and always. `columnDouble` answers `0` for a SQL NULL and `0` is a
 * legitimate value, so a reader that skipped this could not tell them apart — every null number
 * would silently become zero.
 *
 * An INTEGER is taken as a double, which is exact for every integer routier writes. A value beyond
 * that range rounds to a multiple of two at or above 2^53, which is never a safe integer, so the
 * check catches it and falls back to the `BigInt` sqlite-wasm would have returned. The extra call
 * is paid only by values that need it.
 */
export const readColumn = (raw: RawSqlite, statement: number, column: number): unknown => {
    const type = raw.columnType(statement, column);

    if (type === SQLITE_NULL) {
        return null;
    }

    if (type === SQLITE_FLOAT) {
        return raw.columnDouble(statement, column);
    }

    if (type === SQLITE_INTEGER) {
        const value = raw.columnDouble(statement, column);

        return Number.isSafeInteger(value) ? value : raw.columnBigInt(statement, column);
    }

    if (type === SQLITE_TEXT) {
        return raw.text(statement, column);
    }

    if (type === SQLITE_BLOB) {
        return raw.blob(statement, column);
    }

    // Unreachable against a real SQLite, which has exactly five storage classes.
    throw new Error(`SQLite reported an unknown column type: ${type}`);
};

/**
 * Fills `into` with the current row's values and answers it.
 *
 * The array is supplied by the caller and REUSED across rows. Every consumer copies out of it
 * before stepping again — a row object is built from it, or a chunk encoder reads it into typed
 * arrays — so one allocation serves a whole result.
 */
export const readRowInto = (
    raw: RawSqlite,
    statement: number,
    columnCount: number,
    into: unknown[]
): unknown[] => {
    for (let i = 0; i < columnCount; i++) {
        into[i] = readColumn(raw, statement, i);
    }

    return into;
};

/** The shape of `sqlite3.wasm`, as much of it as the adapter below reaches for. */
type SqliteWasm = {
    exports: {
        sqlite3_step(statement: number): number;
        sqlite3_column_type(statement: number, column: number): number;
        sqlite3_column_double(statement: number, column: number): number;
        sqlite3_column_int64(statement: number, column: number): bigint;
        sqlite3_column_text(statement: number, column: number): number;
        sqlite3_column_blob(statement: number, column: number): number;
        sqlite3_column_bytes(statement: number, column: number): number;
    };
    heap8u(): Uint8Array;
};

/**
 * Binds the reading surface to a loaded sqlite-wasm module.
 *
 * The heap view is re-fetched on every read rather than held. WASM memory can grow during a
 * statement, and growing DETACHES every existing view of it — a cached one would throw, or worse,
 * read from a buffer that is no longer the heap.
 */
export const rawSqliteFrom = (wasm: SqliteWasm): RawSqlite => {
    const api = wasm.exports;
    const decoder = new TextDecoder();

    return {
        step: (statement) => api.sqlite3_step(statement) === SQLITE_ROW,
        columnType: (statement, column) => api.sqlite3_column_type(statement, column),
        columnDouble: (statement, column) => api.sqlite3_column_double(statement, column),
        columnBigInt: (statement, column) => api.sqlite3_column_int64(statement, column),

        text: (statement, column) => {
            // `sqlite3_column_text` must be called BEFORE `sqlite3_column_bytes`: the length is
            // the length of the representation the last conversion produced.
            const at = api.sqlite3_column_text(statement, column);
            const length = api.sqlite3_column_bytes(statement, column);

            return decoder.decode(wasm.heap8u().subarray(at, at + length));
        },

        blob: (statement, column) => {
            const at = api.sqlite3_column_blob(statement, column);
            const length = api.sqlite3_column_bytes(statement, column);

            // Copied, not a view. The heap is SQLite's and the bytes are invalidated by the next
            // step; a view would appear to work and then change underneath its holder.
            return wasm.heap8u().slice(at, at + length);
        },
    };
};
