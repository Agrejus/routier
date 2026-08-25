/**
 * Splits a read into its stages and times each one, inside the worker.
 *
 * The codec improved the worker-to-main-thread cost by 5% when the model said 50%. Either the
 * boundary is not where the time is, or the codec is not doing what it should. This answers that
 * by timing the stages separately against the same real statement:
 *
 *   step        stepping the cursor and reading NOTHING out of it
 *   getArray    stepping plus `get([])` — pulls values across the WASM boundary, discards them
 *   getObject   stepping plus `get({})` — what `readRows` did before step 1
 *   buildRows   stepping plus `get([])` plus building one row object per row — today's `readRows`
 *   encode      stepping plus `get([])` plus columnar encoding — today's coded path
 *
 * Each stage includes the one above it, so the differences are the per-stage costs. `step` is the
 * floor: no transfer format and no row shape can beat it.
 *
 * Its own worker, importing sqlite-wasm directly, so nothing here touches shipped code and the
 * timings carry no plugin overhead.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { ChunkEncoder, TRANSFER_VERSION, TransferEncoding } from '@routier/core/transfer';

type Stmt = {
    step(): boolean;
    get(target: unknown[]): unknown[];
    get(target: Record<string, unknown>): Record<string, unknown>;
    getColumnNames(): string[];
    reset(): void;
    finalize(): void;
};

type Database = {
    prepare(sql: string): Stmt;
    exec(options: { sql: string } | string): void;
};

/** SQLite's "a row is ready" return code from `sqlite3_step`. */
const SQLITE_ROW = 100;

/**
 * The raw, unwrapped WASM exports and the heap they read from.
 *
 * `capi.*` routes every call through a wrapper that allocates a rest array and a scope array,
 * dispatches argument and result adapters through Maps, then splices the scope back off. For a
 * one-argument call like `sqlite3_column_count` that ceremony costs more than the work. These are
 * the same functions with none of it.
 */
type RawExports = {
    sqlite3_step(statement: number): number;
    sqlite3_column_double(statement: number, column: number): number;
    sqlite3_column_text(statement: number, column: number): number;
    sqlite3_column_bytes(statement: number, column: number): number;
    sqlite3_column_type(statement: number, column: number): number;
};

let raw: RawExports | null = null;
let heap: (() => Uint8Array) | null = null;
const decoder = new TextDecoder();

const COLUMNS: [string, TransferEncoding][] = [
    ['id', 'float64'],
    ['name', 'clone'],
    ['score', 'float64'],
    ['active', 'boolean-byte'],
    ['createdAt', 'date-f64'],
    ['meta', 'json'],
];

const plan = { version: TRANSFER_VERSION, columns: COLUMNS.map(([name, encoding]) => ({ name, encoding })) };

const SELECT = 'SELECT "id", "name", "score", "active", "createdAt", "meta" FROM "dissect"';

let database: Database | null = null;

const open = async (rows: number) => {
    const sqlite3 = await sqlite3InitModule();

    database = new sqlite3.oo1.DB(':memory:') as Database;
    raw = sqlite3.wasm.exports as RawExports;
    // Re-fetched per row: the WASM heap can grow, which detaches any view held across a call.
    heap = () => sqlite3.wasm.heap8u() as Uint8Array;

    database.exec({
        sql: 'CREATE TABLE "dissect" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT, ' +
            '"score" REAL, "active" INTEGER, "createdAt" TEXT, "meta" JSON)',
    });

    // Built entirely in SQL, so seeding costs no JS row work and cannot skew what follows.
    database.exec({
        sql: `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ${rows})
              INSERT INTO "dissect" ("name", "score", "active", "createdAt", "meta")
              SELECT 'row-' || i, i + 0.5, i % 2,
                     strftime('%Y-%m-%dT%H:%M:%S.000Z', 1767225600 + i, 'unixepoch'),
                     json_object('tag', 't' || (i % 7), 'depth', i % 13)
              FROM n`,
    });
};

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.floor(sorted.length / 2)];
};

/** One timed pass over the whole result, with `work` deciding how much is read out of each row. */
const pass = (work: (statement: Stmt, names: string[]) => void): number => {
    const statement = database!.prepare(SELECT);

    try {
        const names = statement.getColumnNames();
        const started = performance.now();

        work(statement, names);

        return performance.now() - started;
    } finally {
        statement.finalize();
    }
};

/** One text value, decoded straight off the WASM heap. */
const rawText = (pointer: number, column: number): string => {
    const at = raw!.sqlite3_column_text(pointer, column);
    const length = raw!.sqlite3_column_bytes(pointer, column);

    return decoder.decode(heap!().subarray(at, at + length));
};

const STAGES: Record<string, (statement: Stmt, names: string[]) => void> = {
    step: (statement) => {
        while (statement.step()) {
            // Nothing read. The floor for any approach.
        }
    },

    getArray: (statement) => {
        while (statement.step()) {
            statement.get([]);
        }
    },

    getObject: (statement) => {
        while (statement.step()) {
            statement.get({});
        }
    },

    buildRows: (statement, names) => {
        const rows: unknown[] = [];

        while (statement.step()) {
            const values = statement.get([]);
            const row: Record<string, unknown> = {};

            for (let i = 0; i < names.length; i++) {
                row[names[i]] = values[i];
            }

            rows.push(row);
        }
    },

    /**
     * Experiment 2: the same six values per row, read through the raw exports.
     *
     * Integers go through `sqlite3_column_double` rather than `_int64`: the wrapped int64 path
     * returns a BigInt and converts it back, and a double is exact for every integer under 2^53,
     * which is every integer routier writes.
     */
    rawLoop: (statement) => {
        const pointer = (statement as unknown as { pointer: number }).pointer;

        while (raw!.sqlite3_step(pointer) === SQLITE_ROW) {
            raw!.sqlite3_column_double(pointer, 0);
            rawText(pointer, 1);
            raw!.sqlite3_column_double(pointer, 2);
            raw!.sqlite3_column_double(pointer, 3);
            rawText(pointer, 4);
            rawText(pointer, 5);
        }
    },

    /** Experiment 2, plus the row objects the driver actually returns. */
    rawBuild: (statement) => {
        const pointer = (statement as unknown as { pointer: number }).pointer;
        const rows: unknown[] = [];

        while (raw!.sqlite3_step(pointer) === SQLITE_ROW) {
            rows.push({
                id: raw!.sqlite3_column_double(pointer, 0),
                name: rawText(pointer, 1),
                score: raw!.sqlite3_column_double(pointer, 2),
                active: raw!.sqlite3_column_double(pointer, 3),
                createdAt: rawText(pointer, 4),
                meta: rawText(pointer, 5),
            });
        }
    },

    /**
     * Experiment 2, honestly: a NULL check per value.
     *
     * `sqlite3_column_double` answers 0 for a SQL NULL, and 0 is a legitimate value, so a reader
     * that skips this cannot tell them apart — it would turn every NULL number into 0 and every
     * NULL text into the empty string. One extra raw call per value is the price of correctness,
     * and this is what a real implementation would cost.
     */
    rawTyped: (statement) => {
        const pointer = (statement as unknown as { pointer: number }).pointer;
        const rows: unknown[] = [];
        const SQLITE_NULL = 5;

        while (raw!.sqlite3_step(pointer) === SQLITE_ROW) {
            rows.push({
                id: raw!.sqlite3_column_type(pointer, 0) === SQLITE_NULL ? null : raw!.sqlite3_column_double(pointer, 0),
                name: raw!.sqlite3_column_type(pointer, 1) === SQLITE_NULL ? null : rawText(pointer, 1),
                score: raw!.sqlite3_column_type(pointer, 2) === SQLITE_NULL ? null : raw!.sqlite3_column_double(pointer, 2),
                active: raw!.sqlite3_column_type(pointer, 3) === SQLITE_NULL ? null : raw!.sqlite3_column_double(pointer, 3),
                createdAt: raw!.sqlite3_column_type(pointer, 4) === SQLITE_NULL ? null : rawText(pointer, 4),
                meta: raw!.sqlite3_column_type(pointer, 5) === SQLITE_NULL ? null : rawText(pointer, 5),
            });
        }
    },

    encode: (statement) => {
        const encoder = new ChunkEncoder(plan);
        const emitted: unknown[] = [];

        while (statement.step()) {
            encoder.appendRow(statement.get([]));

            if (encoder.isFull) {
                emitted.push(encoder.take());
            }
        }

        emitted.push(encoder.take());
    },
};

const GROUPED = `SELECT json_group_array(json_object(
    'id', "id", 'name', "name", 'score', "score",
    'active', "active", 'createdAt', "createdAt", 'meta', json("meta")
)) AS "doc" FROM "dissect"`;

/**
 * Experiment 1: SQLite builds the whole result as one JSON document in C.
 *
 * Extraction collapses from ~64,000 wrapped calls to one text read. `json("meta")` rather than
 * `"meta"` because that column already holds JSON — passing it as a plain value would encode the
 * text a second time and the main thread would get a string where an object belongs.
 */
const groupedPass = (parse: boolean): number => {
    const statement = database!.prepare(GROUPED);

    try {
        const started = performance.now();

        statement.step();

        const pointer = (statement as unknown as { pointer: number }).pointer;
        const doc = rawText(pointer, 0);
        const parsed = parse ? JSON.parse(doc) : doc;

        // Referenced so nothing can be optimised away.
        if (parsed == null) {
            throw new Error('grouped read produced nothing');
        }

        return performance.now() - started;
    } finally {
        statement.finalize();
    }
};

const run = async (rows: number, runs: number) => {
    await open(rows);

    const results: Record<string, number> = {};

    for (const [name, work] of Object.entries(STAGES)) {
        pass(work);

        results[name] = median(Array.from({ length: runs }, () => pass(work)));
    }

    groupedPass(false);
    results.jsonText = median(Array.from({ length: runs }, () => groupedPass(false)));
    results.jsonParsed = median(Array.from({ length: runs }, () => groupedPass(true)));

    return { rows, ...results };
};

self.onmessage = async (event: MessageEvent<{ rows: number; runs: number }>) => {
    try {
        const result = await run(event.data.rows, event.data.runs);

        (self as unknown as Worker).postMessage({ ok: true, result });
    } catch (error) {
        (self as unknown as Worker).postMessage({ ok: false, error: (error as Error)?.message ?? String(error) });
    }
};
