/**
 * The shipped PGlite plugin, through its real worker, with and without the coded channel.
 *
 * The earlier probe measured a hand-built prototype. This drives the actual plugin: real leader
 * election, real driver, real `codedReads.ts` beside PGlite's own proxy. The only claim being
 * checked is that entities come back identical either way, and what the channel is worth.
 */
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PGliteDbPlugin } from '../../pglite/src/index.browser';

const schema = s.define('pg_rows', {
    // A SERIAL key, not a uuid. The two runs use separate databases — the codec setting is part
    // of a data directory's identity — so a random key would differ per row and the comparison
    // could never match, whatever the codec did.
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

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

let counter = 0;

const seedRows = (count: number) => Array.from({ length: count }, (_, i) => ({
    name: `row-${i}`,
    score: i + 0.5,
    active: i % 2 === 0,
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000),
    meta: { tag: `t${i % 7}`, depth: i % 13 },
}));

/**
 * @param workerUrl The plugin's own worker. Passed explicitly because esbuild does not rewrite
 * `new URL('./pgliteWorker.js', import.meta.url)` the way the published bundlers do.
 */
const run = async (workerUrl: string, count: number, runs: number, codec: boolean) => {
    const store = new Store(new PGliteDbPlugin(`memory://e2e-${counter++}`, { workerUrl, codec }));

    try {
        for (let from = 0; from < count; from += 2000) {
            await store.rows.addAsync(...(seedRows(Math.min(2000, count - from)) as never[]));
            await store.saveChangesAsync();
        }

        await store.rows.toArrayAsync();

        const samples: number[] = [];
        let rows: unknown[] = [];

        for (let i = 0; i < runs; i++) {
            const started = performance.now();
            rows = await store.rows.toArrayAsync() as unknown[];
            samples.push(performance.now() - started);
        }

        return { ms: median(samples), fingerprint: fingerprint(rows), count: rows.length };
    } finally {
        await store.destroyAsync().catch((): undefined => undefined);
    }
};

declare const window: Record<string, unknown>;

/**
 * The same read both ways through the shipped plugin.
 *
 * Separate databases, seeded identically — the codec setting is part of a data directory's
 * identity, so one directory cannot serve both.
 */
const compare = async (count: number, runs: number) => {
    const coded = await run('./pgliteRealWorker.js', count, runs, true);
    const cloned = await run('./pgliteRealWorker.js', count, runs, false);

    return {
        rows: coded.count,
        codedMs: coded.ms,
        clonedMs: cloned.ms,
        speedup: cloned.ms / coded.ms,
        identical: coded.fingerprint === cloned.fingerprint,
        codedSample: coded.fingerprint.slice(0, 120),
        clonedSample: cloned.fingerprint.slice(0, 120),
    };
};

window.__pgEndToEnd = {
    read: (count: number, runs: number) => run('./pgliteRealWorker.js', count, runs, true),
    compare,
};
