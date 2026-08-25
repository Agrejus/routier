/**
 * How much of a PGlite read is the worker boundary?
 *
 * Step 9 of the transfer plan is adopting the codec for PGlite. That step assumes the boundary is
 * worth optimising, which is exactly the assumption that turned out to be wrong for SQLite — there
 * the `postMessage` was 11% of a read and pulling values out of the engine was 75%. Building the
 * PGlite adoption before checking would repeat the mistake.
 *
 * The comparison is the same query, same data, two ways:
 *
 *   inPage   `PGlite` constructed on the main thread. No worker, so NO boundary at all.
 *   viaWorker `PGliteWorker`, which proxies to a leader worker and structured-clones every result.
 *
 * The difference is the whole cost of crossing, and it is the ceiling on what any transfer format
 * could win here. Both use `memory://` so neither pays for storage, and the query, the row shape
 * and PGlite's own row materialisation are identical on both sides.
 *
 * Lives in the sqlite plugin's harness rather than pglite's because this is where the browser
 * runner already exists; it imports nothing from the sqlite plugin.
 */
import { PGlite } from '@electric-sql/pglite';
import { decodeChunk, TRANSFER_VERSION, TransferEncoding, TransferPlan } from '@routier/core/transfer';

type Queryable = {
    query(sql: string, params?: unknown[], options?: { rowMode?: 'object' | 'array' }): Promise<{ rows: unknown[] }>;
    exec(sql: string): Promise<unknown>;
    close(): Promise<void>;
};

const SELECT = 'SELECT "id", "name", "score", "active", "created_at", "meta" FROM probe';

const SEED_SQL = (rows: number) => `
        CREATE TABLE probe (
            "id" SERIAL PRIMARY KEY,
            "name" TEXT,
            "score" DOUBLE PRECISION,
            "active" BOOLEAN,
            "created_at" TIMESTAMPTZ,
            "meta" JSONB
        );
        INSERT INTO probe ("name", "score", "active", "created_at", "meta")
        SELECT 'row-' || i, i + 0.5, i % 2 = 0,
               TIMESTAMPTZ '2026-01-01 00:00:00Z' + (i || ' seconds')::interval,
               jsonb_build_object('tag', 't' || (i % 7), 'depth', i % 13)
        FROM generate_series(0, ${rows - 1}) AS i;
`;

const seed = (database: Queryable, rows: number) => database.exec(SEED_SQL(rows));

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.floor(sorted.length / 2)];
};

const timeReads = async (database: Queryable, runs: number) => {
    await database.query(SELECT);

    const samples: number[] = [];
    let rows = 0;

    for (let i = 0; i < runs; i++) {
        const started = performance.now();
        const result = await database.query(SELECT);

        samples.push(performance.now() - started);
        rows = result.rows.length;
    }

    return { ms: median(samples), rows };
};

/**
 * @param workerUrl A worker running `@electric-sql/pglite/worker`, so `PGliteWorker` has a leader
 * to proxy to. Supplied by the caller because a bundler must see the URL literal.
 */
const compare = async (rows: number, runs: number, makeWorker: () => Worker) => {
    const inPage = new PGlite('memory://probe-page') as unknown as Queryable;
    const { PGliteWorker } = await import('@electric-sql/pglite/worker');
    const viaWorker = await PGliteWorker.create(makeWorker(), {
        meta: { dataDir: 'memory://probe-worker' },
    }) as unknown as Queryable;

    try {
        await seed(inPage, rows);
        await seed(viaWorker, rows);

        const page = await timeReads(inPage, runs);
        const worker = await timeReads(viaWorker, runs);

        return {
            rows,
            inPageMs: page.ms,
            viaWorkerMs: worker.ms,
            /** Everything crossing costs: the ceiling on what a transfer format could reclaim. */
            boundaryMs: worker.ms - page.ms,
            boundaryShare: (worker.ms - page.ms) / worker.ms,
            rowsMatch: page.rows === worker.rows && page.rows === rows,
        };
    } finally {
        await inPage.close().catch((): undefined => undefined);
        await viaWorker.close().catch((): undefined => undefined);
    }
};

/**
 * Object rows against array rows, in the page, with no boundary involved.
 *
 * The same lever that mattered for SQLite: `Stmt.get({})` resolved column names per row and cost
 * 1.7x more than the array form. PGlite's `rowMode: 'array'` skips building a keyed object per
 * row, so if its row materialisation is the bulk of a read this is where it shows.
 */
const compareRowMode = async (rows: number, runs: number) => {
    const database = new PGlite('memory://probe-rowmode') as unknown as Queryable;

    try {
        await seed(database, rows);

        const time = async (mode: 'object' | 'array') => {
            await database.query(SELECT, [], { rowMode: mode });

            const samples: number[] = [];

            for (let i = 0; i < runs; i++) {
                const started = performance.now();
                await database.query(SELECT, [], { rowMode: mode });
                samples.push(performance.now() - started);
            }

            return median(samples);
        };

        const objectMs = await time('object');
        const arrayMs = await time('array');

        return { rows, objectMs, arrayMs, savedMs: objectMs - arrayMs };
    } finally {
        await database.close().catch((): undefined => undefined);
    }
};

/** What PGlite hands back, which decides which encodings its mapping can use. */
const valueShapes = async () => {
    const database = new PGlite('memory://probe-shapes') as unknown as Queryable;

    try {
        await seed(database, 1);

        const row = (await database.query(SELECT)).rows[0] as Record<string, unknown>;

        return {
            id: typeof row.id,
            name: typeof row.name,
            score: typeof row.score,
            active: typeof row.active,
            createdAtIsDate: row.created_at instanceof Date,
            metaIsObject: typeof row.meta === 'object' && row.meta !== null,
        };
    } finally {
        await database.close().catch((): undefined => undefined);
    }
};

/** The select list's columns, and what PGlite's parsed values allow for each. */
const CODEC_COLUMNS: [string, TransferEncoding][] = [
    ['id', 'float64'],
    ['name', 'clone'],
    ['score', 'float64'],
    ['active', 'boolean-byte'],
    ['created_at', 'date-f64'],
    ['meta', 'json-stringify'],
];

const codecPlan: TransferPlan = {
    version: TRANSFER_VERSION,
    columns: CODEC_COLUMNS.map(([name, encoding]) => ({ name, encoding })),
};

/** A minimal routier-owned channel: send a request, accumulate decoded chunks, resolve on last. */
const codecChannel = (worker: Worker) => {
    const pending = new Map<number, { resolve: (rows: unknown[]) => void; reject: (e: Error) => void; rows: unknown[] }>();
    let nextId = 0;

    worker.onmessage = (event: MessageEvent<any>) => {
        const message = event.data;
        const waiting = pending.get(message.id);

        if (waiting == null) return;

        if (message.ok === false) {
            pending.delete(message.id);
            waiting.reject(new Error(message.error));
            return;
        }

        if ('chunk' in message) {
            for (const row of decodeChunk(codecPlan, message.chunk)) {
                waiting.rows.push(row);
            }

            if (message.last) {
                pending.delete(message.id);
                waiting.resolve(waiting.rows);
            }

            return;
        }

        pending.delete(message.id);
        waiting.resolve(message.rows ?? []);
    };

    return {
        send: (request: Record<string, unknown>) => new Promise<unknown[]>((resolve, reject) => {
            const id = nextId++;

            pending.set(id, { resolve, reject, rows: [] });
            worker.postMessage({ ...request, id });
        }),
    };
};

/** Types included: the risk is a Date arriving as a number, which values alone would not show. */
const fingerprint = (rows: readonly unknown[]): string => {
    const describe = (value: unknown): string => {
        if (value === null || value === undefined) return 'null';
        if (value instanceof Date) return `Date(${value.getTime()})`;
        if (Array.isArray(value)) return `[${value.map(describe).join(',')}]`;
        if (typeof value === 'object') {
            return `{${Object.keys(value as object).sort()
                .map(k => `${k}:${describe((value as Record<string, unknown>)[k])}`).join(',')}}`;
        }
        return `${typeof value}(${String(value)})`;
    };

    return `${rows.length}|${rows.map(describe).join(';')}`;
};

/**
 * The prototype question: of what crossing costs, how much does the codec reclaim?
 *
 * Compares PGlite's own proxy against a routier-owned channel doing the same query, both against
 * their own in-memory database seeded identically.
 */
const compareCodec = async (rows: number, runs: number, makeCodecWorker: () => Worker, makeLeader: () => Worker) => {
    const { PGliteWorker } = await import('@electric-sql/pglite/worker');
    const viaProxy = await PGliteWorker.create(makeLeader(), {
        meta: { dataDir: 'memory://codec-proxy' },
    }) as unknown as Queryable;

    const worker = makeCodecWorker();
    const channel = codecChannel(worker);

    try {
        await channel.send({ kind: 'open', dataDir: 'memory://codec-own' });
        await seed(viaProxy, rows);
        await channel.send({ kind: 'exec', sql: SEED_SQL(rows) });

        const time = async (read: () => Promise<unknown[]>) => {
            await read();

            const samples: number[] = [];
            let last: unknown[] = [];

            for (let i = 0; i < runs; i++) {
                const started = performance.now();
                last = await read();
                samples.push(performance.now() - started);
            }

            return { ms: median(samples), rows: last };
        };

        const proxyRun = await time(async () => (await viaProxy.query(SELECT)).rows);
        const codedRun = await time(() => channel.send({ kind: 'all', sql: SELECT, plan: codecPlan }));

        return {
            rows,
            proxyMs: proxyRun.ms,
            codedMs: codedRun.ms,
            speedup: proxyRun.ms / codedRun.ms,
            identical: fingerprint(proxyRun.rows) === fingerprint(codedRun.rows),
            proxySample: fingerprint(proxyRun.rows.slice(0, 1)),
            codedSample: fingerprint(codedRun.rows.slice(0, 1)),
        };
    } finally {
        worker.terminate();
        await viaProxy.close().catch((): undefined => undefined);
    }
};

declare const window: Record<string, unknown>;

window.__pglite = {
    compare: (rows: number, runs: number) =>
        compare(rows, runs, () => new Worker(new URL('./pgliteLeader.js', import.meta.url), { type: 'module' })),
    valueShapes,
    compareRowMode,
    compareCodec: (rows: number, runs: number) => compareCodec(
        rows,
        runs,
        () => new Worker(new URL('./pgliteCodecWorker.js', import.meta.url), { type: 'module' }),
        () => new Worker(new URL('./pgliteLeader.js', import.meta.url), { type: 'module' })
    ),
};
