/**
 * Runs inside a real page, against a real worker, over real SQLite WASM.
 *
 * Everything the Node suites cannot reach: an actual `postMessage`, actual buffer transfer, an
 * actual Content-Security-Policy, and the actual cost of the boundary. Those suites verify the
 * codec's logic against fakes; this verifies that the platform agrees.
 *
 * The comparison is always ENTITY level, codec on against codec off. Comparing raw driver rows
 * would fail by design — the coded path returns `Date` objects and parsed objects where the clone
 * path returns ISO text and JSON text. They are equivalent only after shaping, and "the entities
 * are identical" is the whole of what the codec promises.
 *
 * Exposed on `window.__harness` and driven by `run.mjs`. Everything returns plain JSON.
 */

import { s } from '@routier/core/schema';
import { isTransferCodecSupported } from '@routier/core/transfer';
import { DataStore } from '@routier/datastore';
import { SqliteDbPluginBase } from '../../../plugins/sqlite/src/plugin';
import { wasmDriver } from '../../../plugins/sqlite/src/drivers/wasm';
import type { SqliteConnection } from '../../../plugins/sqlite/src/drivers/types';
import { entityResultColumns } from '@routier/sql-plugin-core';

const schema = s.define('bench_rows', {
    id: s.number().key().identity(),
    name: s.string(),
    score: s.number(),
    active: s.boolean(),
    createdAt: s.date(),
    meta: s.object({ tag: s.string(), depth: s.number() }),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

/**
 * A stable summary of a result set, TYPES INCLUDED.
 *
 * The types are the point. The risk the codec carries is returning a number where a `Date`
 * belongs, or a string where a parsed object belongs — a value-only comparison would miss exactly
 * that and call the result identical.
 */
const fingerprint = (rows: readonly unknown[]): string => {
    const describe = (value: unknown): string => {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (value instanceof Date) return `Date(${value.getTime()})`;
        if (Array.isArray(value)) return `[${value.map(describe).join(',')}]`;
        if (typeof value === 'object') {
            return `{${Object.keys(value as object).sort()
                .map(key => `${key}:${describe((value as Record<string, unknown>)[key])}`).join(',')}}`;
        }
        return `${typeof value}(${String(value)})`;
    };

    return `${rows.length}|${rows.map(describe).join(';')}`;
};

let counter = 0;

/**
 * One in-memory database per scenario, and both stores in a scenario share its NAME.
 *
 * The worker keeps one database per name, so the codec-off store reads exactly the rows the
 * codec-on store wrote. A per-store name would compare two different databases.
 */
const storeOver = (databaseName: string, workerUrl: string, codec: boolean) => new Store(
    new SqliteDbPluginBase(databaseName, wasmDriver({ storage: 'memory', workerUrl, codec }))
);

const seedRows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        name: `row-${i}`,
        score: i + 0.5,
        active: i % 2 === 0,
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000),
        meta: { tag: `t${i % 7}`, depth: i % 13 },
    }));

/**
 * Seeds in batches.
 *
 * One INSERT binds a parameter per column per row, and SQLite refuses past
 * SQLITE_MAX_VARIABLE_NUMBER with "too many SQL variables" — reached at about 6,500 rows for this
 * schema. Batching is a fact about seeding, not about the thing being measured.
 */
const SEED_BATCH = 2000;

const seed = async (store: Store, count: number) => {
    for (let from = 0; from < count; from += SEED_BATCH) {
        const batch = seedRows(Math.min(SEED_BATCH, count - from));

        await store.rows.addAsync(...(batch as never[]));
        await store.saveChangesAsync();
    }
};

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.floor(sorted.length / 2)];
};

export type ReadComparison = {
    rows: number;
    codedFingerprint: string;
    clonedFingerprint: string;
    identical: boolean;
    codedMs: number;
    clonedMs: number;
    speedup: number;
};

/**
 * Seeds a database, then reads it back both ways and compares.
 *
 * `runs` reads are timed per path and the median reported; the first read of each is discarded, so
 * neither pays for the worker's first-query warm-up.
 */
const compareRead = async (
    workerUrl: string,
    count: number,
    runs = 5
): Promise<ReadComparison> => {
    const databaseName = `harness-${counter++}`;
    const coded = storeOver(databaseName, workerUrl, true);
    const cloned = storeOver(databaseName, workerUrl, false);

    try {
        if (count > 0) {
            await seed(coded, count);
        }

        const time = async (store: Store) => {
            await store.rows.toArrayAsync();

            const samples: number[] = [];
            let last: unknown[] = [];

            for (let i = 0; i < runs; i++) {
                const started = performance.now();
                last = await store.rows.toArrayAsync() as unknown[];
                samples.push(performance.now() - started);
            }

            return { ms: median(samples), rows: last };
        };

        const codedRun = await time(coded);
        const clonedRun = await time(cloned);

        return {
            rows: codedRun.rows.length,
            codedFingerprint: fingerprint(codedRun.rows),
            clonedFingerprint: fingerprint(clonedRun.rows),
            identical: fingerprint(codedRun.rows) === fingerprint(clonedRun.rows),
            codedMs: codedRun.ms,
            clonedMs: clonedRun.ms,
            speedup: clonedRun.ms / codedRun.ms,
        };
    } finally {
        await coded.destroyAsync().catch((): undefined => undefined);
    }
};

/** A projection, a join-free filter and an aggregate, each compared both ways. */
const compareShapes = async (workerUrl: string, count: number) => {
    const databaseName = `harness-${counter++}`;
    const coded = storeOver(databaseName, workerUrl, true);
    const cloned = storeOver(databaseName, workerUrl, false);

    try {
        await seed(coded, count);

        const shapes: Record<string, (store: Store) => Promise<unknown>> = {
            all: store => store.rows.toArrayAsync(),
            filtered: store => store.rows.where(x => x.score > 10).toArrayAsync(),
            projection: store => store.rows.map(x => ({ when: x.createdAt, s: x.score })).toArrayAsync(),
            sorted: store => store.rows.sort(x => x.name).take(25).toArrayAsync(),
            count: store => store.rows.countAsync(),
            nested: store => store.rows.map(x => x.meta).toArrayAsync(),
        };

        /**
         * Outcomes, not just values. A query that THROWS must throw the same way on both paths —
         * otherwise a pre-existing failure could be mistaken for a codec defect, or the codec
         * could quietly turn a failure into a wrong answer.
         */
        const outcome = async (run: (store: Store) => Promise<unknown>, store: Store) => {
            try {
                const value = await run(store);

                return fingerprint(Array.isArray(value) ? value : [value]);
            } catch (error) {
                return `threw(${(error as Error)?.message ?? String(error)})`;
            }
        };

        const results: Record<string, { identical: boolean; coded: string; cloned: string; threw: boolean }> = {};

        for (const [name, run] of Object.entries(shapes)) {
            const a = await outcome(run, coded);
            const b = await outcome(run, cloned);

            results[name] = { identical: a === b, coded: a, cloned: b, threw: a.startsWith('threw(') };
        }

        return results;
    } finally {
        await coded.destroyAsync().catch((): undefined => undefined);
    }
};

/**
 * Where the time in a read actually goes.
 *
 * The codec can only ever improve one term of this sum. The plan's harness measured that term in
 * isolation and reported 1.5-2.15x; the real path came in at 1.15x, which means the term is a
 * small share of the whole. This decomposes it so the share is a number rather than an inference.
 *
 * - `execMs` runs the SELECT through `run`, which reaches `exec` for a parameterless statement.
 *   SQLite does all its work and NO JavaScript row objects are built. Pure engine cost.
 * - `driverCodedMs` / `driverClonedMs` are `connection.all`: engine cost, plus building or
 *   encoding rows, plus the boundary, plus decoding. Everything the codec touches.
 * - `entityMs` is the whole `toArrayAsync`. The remainder over the driver figure is shaping,
 *   translation, change tracking and proxying — main-thread work the codec cannot reach.
 */
const profilePhases = async (workerUrl: string, count: number, runs = 5) => {
    const databaseName = `harness-${counter++}`;
    const coded = storeOver(databaseName, workerUrl, true);
    const cloned = storeOver(databaseName, workerUrl, false);

    try {
        await seed(coded, count);

        const sql = 'SELECT "id", "name", "score", "active", "createdAt", "meta" FROM "bench_rows"';
        const columns = entityResultColumns(schema as never);

        const time = async (work: () => Promise<unknown>) => {
            await work();

            const samples: number[] = [];

            for (let i = 0; i < runs; i++) {
                const started = performance.now();
                await work();
                samples.push(performance.now() - started);
            }

            return median(samples);
        };

        /** Held only for the length of one timing run: two at once would wait on each other. */
        const overConnection = async (codec: boolean, work: (c: SqliteConnection) => Promise<number>) => {
            const connection = await wasmDriver({ storage: 'memory', workerUrl, codec }).open(databaseName);

            try {
                return await work(connection);
            } finally {
                await connection.close();
            }
        };

        const execMs = await overConnection(false, c => time(() => c.run(sql)));
        const driverCodedMs = await overConnection(true, c => time(() => c.all(sql, [], columns)));
        const driverClonedMs = await overConnection(false, c => time(() => c.all(sql, [])));
        const entityCodedMs = await time(() => coded.rows.toArrayAsync());
        const entityClonedMs = await time(() => cloned.rows.toArrayAsync());

        return {
            rows: count,
            execMs,
            driverCodedMs,
            driverClonedMs,
            entityCodedMs,
            entityClonedMs,
            /** Rows-into-JS plus boundary, per path: everything the codec can influence. */
            reachableCodedMs: driverCodedMs - execMs,
            reachableClonedMs: driverClonedMs - execMs,
            /** Shaping, translation, change tracking: out of the codec's reach entirely. */
            downstreamMs: entityClonedMs - driverClonedMs,
            /** What the codec saved, as a share of the whole read. */
            savedShare: (entityClonedMs - entityCodedMs) / entityClonedMs,
        };
    } finally {
        await coded.destroyAsync().catch((): undefined => undefined);
    }
};

/**
 * The cost of a small read, measured by repetition rather than by one clock reading.
 *
 * A single 1-row read takes less time than `performance.now()` can resolve, so timing one and
 * reporting it gives a number made of rounding. This runs many reads, times the whole batch, and
 * divides — the per-read figure is then as precise as the batch is long.
 */
const compareSmall = async (workerUrl: string, count: number, iterations: number) => {
    const databaseName = `harness-${counter++}`;
    const coded = storeOver(databaseName, workerUrl, true);
    const cloned = storeOver(databaseName, workerUrl, false);

    try {
        if (count > 0) {
            await seed(coded, count);
        }

        const perRead = async (store: Store) => {
            for (let i = 0; i < Math.min(iterations, 50); i++) {
                await store.rows.toArrayAsync();
            }

            const started = performance.now();

            for (let i = 0; i < iterations; i++) {
                await store.rows.toArrayAsync();
            }

            return (performance.now() - started) / iterations;
        };

        // Interleaved order across calls would be better still; run each in a block and repeat the
        // whole comparison twice, taking the second, so neither path pays for the other's warm-up.
        await perRead(coded);
        await perRead(cloned);

        const codedMs = await perRead(coded);
        const clonedMs = await perRead(cloned);

        return { rows: count, iterations, codedMs, clonedMs, deltaMs: codedMs - clonedMs };
    } finally {
        await coded.destroyAsync().catch((): undefined => undefined);
    }
};

/**
 * How long the main thread was unavailable during a read.
 *
 * Total wall clock cannot answer this. One 100ms block and six 16ms blocks can take the same time
 * and feel completely different, and non-blocking is the property the codec was built for: the
 * clone path deserialises the whole row array in one go on the main thread, while the coded path
 * decodes a chunk at a time between messages.
 *
 * A `MessageChannel` ticker rather than `setTimeout`: nested timeouts are clamped to 4ms, which is
 * the same order as the gaps being measured. A port message has no clamp, so every gap between
 * ticks is main-thread occupancy and nothing else.
 */
const ticker = () => {
    const gaps: number[] = [];
    const channel = new MessageChannel();
    let last = performance.now();
    let running = true;

    channel.port1.onmessage = () => {
        const now = performance.now();

        gaps.push(now - last);
        last = now;

        if (running) {
            channel.port2.postMessage(0);
        }
    };

    channel.port2.postMessage(0);

    return {
        stop: () => {
            running = false;
            channel.port1.close();
            channel.port2.close();

            return gaps;
        },
    };
};

export type BlockingProfile = {
    rows: number;
    /** The longest single stretch the main thread was busy. */
    longestBlockMs: number;
    /** Time spent in stretches over 16ms — one dropped frame or worse. */
    blockedOver16Ms: number;
    /** How many such stretches. */
    stretchesOver16: number;
    /** How many over 50ms, the threshold the platform itself calls a long task. */
    stretchesOver50: number;
    totalMs: number;
};

const profileBlocking = async (workerUrl: string, count: number) => {
    const databaseName = `harness-${counter++}`;
    const coded = storeOver(databaseName, workerUrl, true);
    const cloned = storeOver(databaseName, workerUrl, false);

    try {
        await seed(coded, count);

        const profile = async (store: Store): Promise<BlockingProfile> => {
            await store.rows.toArrayAsync();

            const running = ticker();
            const started = performance.now();

            await store.rows.toArrayAsync();

            const totalMs = performance.now() - started;
            const gaps = running.stop();
            const over16 = gaps.filter(gap => gap > 16);
            // A loop, not `Math.max(...gaps)`: a long read produces hundreds of thousands of
            // ticks and spreading them into a call overflows the stack.
            let longest = 0;

            for (const gap of gaps) {
                if (gap > longest) {
                    longest = gap;
                }
            }

            return {
                rows: count,
                longestBlockMs: longest,
                blockedOver16Ms: over16.reduce((sum, gap) => sum + gap, 0),
                stretchesOver16: over16.length,
                stretchesOver50: gaps.filter(gap => gap > 50).length,
                totalMs,
            };
        };

        return { coded: await profile(coded), cloned: await profile(cloned) };
    } finally {
        await coded.destroyAsync().catch((): undefined => undefined);
    }
};

/**
 * Proof that the coded path actually executed, rather than silently falling back.
 *
 * Without this the benchmark could be comparing the clone path to itself and reporting the
 * difference as noise. At the DRIVER level the two paths are visibly different: the codec decodes
 * to the final entity shape, so a date arrives as a `Date` and a nested object already parsed,
 * where cloning hands back the ISO text and the JSON text SQLite stored.
 */
const proveCodecRan = async (workerUrl: string) => {
    const databaseName = `harness-${counter++}`;
    const store = storeOver(databaseName, workerUrl, true);

    try {
        await seed(store, 3);

        const sql = 'SELECT "id", "name", "score", "active", "createdAt", "meta" FROM "bench_rows"';
        const columns = entityResultColumns(schema as never);

        /**
         * One connection at a time. The worker holds ONE connection per database and the driver
         * hands it out in turns, so holding two at once waits forever — the same contract every
         * other driver has, and the reason a save's transaction is not interleaved with another
         * store's.
         */
        const readOnce = async (codec: boolean) => {
            const connection = await wasmDriver({ storage: 'memory', workerUrl, codec }).open(databaseName);

            try {
                return (await connection.all(sql, [], columns))[0] as Record<string, unknown>;
            } finally {
                await connection.close();
            }
        };

        const codedRow = await readOnce(true);
        const clonedRow = await readOnce(false);

        return {
            codedDateIsDate: codedRow.createdAt instanceof Date,
            clonedDateIsText: typeof clonedRow.createdAt === 'string',
            codedMetaIsObject: typeof codedRow.meta === 'object' && codedRow.meta !== null,
            clonedMetaIsText: typeof clonedRow.meta === 'string',
            codedBooleanIsBoolean: typeof codedRow.active === 'boolean',
            clonedBooleanIsNumber: typeof clonedRow.active === 'number',
        };
    } finally {
        await store.destroyAsync().catch((): undefined => undefined);
    }
};

/** A write path: the RETURNING row the change tracker gets back. */
const compareWrite = async (workerUrl: string) => {
    const databaseName = `harness-${counter++}`;
    const store = storeOver(databaseName, workerUrl, true);

    try {
        const [added] = await store.rows.addAsync(...(seedRows(1) as never[]));
        await store.saveChangesAsync();

        const readBack = await store.rows.toArrayAsync();

        return {
            addedFingerprint: fingerprint([added]),
            readBackFingerprint: fingerprint(readBack),
            identical: fingerprint([added]) === fingerprint(readBack),
        };
    } finally {
        await store.destroyAsync().catch((): undefined => undefined);
    }
};

/**
 * Runs the stage-by-stage dissection in its own worker and returns the timings.
 *
 * A separate worker on purpose: it imports sqlite-wasm directly, so no plugin code is in the way
 * of the numbers.
 */
const dissect = (rows: number, runs = 5): Promise<Record<string, number>> =>
    new Promise((resolve, reject) => {
        const worker = new Worker('./dissectWorker.js', { type: 'module' });

        worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: Record<string, number>; error?: string }>) => {
            worker.terminate();

            if (event.data.ok) {
                resolve(event.data.result!);
                return;
            }

            reject(new Error(event.data.error));
        };

        worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(`dissect worker failed: ${event.message ?? 'no message'}`));
        };

        worker.postMessage({ rows, runs });
    });

declare const window: Record<string, unknown>;

window.__harness = {
    codecSupported: () => isTransferCodecSupported(),
    compareRead,
    compareShapes,
    compareWrite,
    proveCodecRan,
    profileBlocking,
    profilePhases,
    dissect,
    compareSmall,
};
