import { RawSqlite, readRowInto } from './wasmRaw';

/**
 * Reading a prepared statement's rows.
 *
 * Separate from `wasmWorker.ts` so it can be tested without loading the SQLite WASM module,
 * which that file imports statically and on purpose.
 */

/** The part of sqlite-wasm's `Stmt` used here. Typed structurally so a test can stand in for it. */
export type WasmStatement = {
    bind(params: unknown[]): void;
    getColumnNames(): string[];
    finalize(): void;
    /** The `sqlite3_stmt*` this wraps, which is what the raw exports take. */
    readonly pointer: number;
};

/**
 * Collects every remaining row as an object keyed by column name.
 *
 * Stepping and value reading go through the raw WASM exports rather than `Stmt.get`. The oo1
 * accessor costs three wrapped calls per value and measured as three quarters of a read; see
 * `wasmRaw.ts`. Column names are read once — resolving them per row is what made the object form
 * of `get` slower still.
 */
export const readRows = (raw: RawSqlite, statement: WasmStatement): unknown[] => {
    const rows: unknown[] = [];
    const names = statement.getColumnNames();
    const columnCount = names.length;
    const pointer = statement.pointer;
    // One array for the whole result: each row is copied out of it before the next step.
    const values: unknown[] = new Array(columnCount);

    while (raw.step(pointer)) {
        readRowInto(raw, pointer, columnCount, values);

        const row: Record<string, unknown> = {};

        for (let i = 0; i < columnCount; i++) {
            row[names[i]] = values[i];
        }

        rows.push(row);
    }

    return rows;
};
