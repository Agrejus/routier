import { afterAll, afterEach, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { DataStore } from '@routier/datastore';
import { contractProductSchema } from '@routier/test-utils';
import { cleanupBackendArtifacts, memoryBackend, stressDescribe, stressIt } from './harness';

/**
 * S9 — a throughput floor.
 *
 * This is not a benchmark. A benchmark asks "how fast is it" and wants precision; this
 * asks "did it fall off a cliff" and wants only to be free of false alarms. The
 * distinction sets every decision below.
 *
 * Why it is worth having at all: `specs/stress-testing.md` records that a broken SQL
 * translator still returns *correct* rows, because queries fall back to in-memory
 * filtering. Correctness tests cannot see that regression — the only symptom is that the
 * work moved from the database to the client. Throughput collapse is the observable, so
 * something has to observe it.
 *
 * Why the floor is half the baseline, which sounds absurdly loose: measurements taken
 * inside a Jest worker share a machine with whatever else is running, and a CI runner's
 * neighbours are not ours to control. A tight floor would fail on a noisy afternoon and be
 * disabled within a week, which is worth less than a loose floor nobody mutes. A 2x
 * collapse is the size of regression this is for — an O(n) path becoming O(n^2), or a
 * query dropping to the in-memory fallback.
 *
 * Noise control: each measurement is the best of several rounds rather than a mean. The
 * fastest round is the one least interfered with, and the quantity being estimated is
 * "how fast can this go", not "how fast was this particular afternoon".
 *
 * **Why the comparison is a ratio and not a rate.** A loose floor and best-of-N were not
 * enough. In a full `--selectProjects stress` run this scenario measures wall-clock
 * throughput inside a Jest worker while up to eleven other stress suites saturate every
 * core, and it failed roughly twice in nine runs — never once in isolation. An absolute
 * rate cannot tell "Routier got slower" from "this machine was busy", which is the one
 * distinction the check exists to make.
 *
 * So each round also measures a **reference workload** — plain `Map` inserts and reads, no
 * Routier involved — in the same process, in the same round, next to the real measurement.
 * What is compared against the baseline is `routier รท reference`. Contention scales both
 * numbers, so it cancels; a genuine regression moves only the numerator. This is the same
 * rule the spec's own gotchas already prescribe for timing: normalise, do not use an
 * absolute.
 *
 * The recorded rates stay in the baseline file, and are printed, because a human reading a
 * failure wants them. Nothing compares against them.
 */

const ENTITIES = 10_000;
const ROUNDS = 3;
/** Fraction of the recorded baseline ratio a measurement must clear. */
const FLOOR = 0.5;
/**
 * Size of the reference workload. Large enough that a round takes tens of milliseconds —
 * below that, timer granularity is a bigger term than the contention being cancelled.
 */
const REFERENCE_OPERATIONS = 200_000;

const BASELINE_FILE = path.join(__dirname, 'throughput-baseline.json');

type Baseline = {
    /**
     * Routier throughput divided by the reference workload's throughput, measured in the
     * same round. THIS is what a run is compared against — see the header.
     */
    readonly insertRatio: number;
    readonly readRatio: number;
    /** Context for a human reading a failure — never compared against. */
    readonly insertsPerSecond: number;
    readonly readsPerSecond: number;
    readonly referenceOperationsPerSecond: number;
    readonly recordedOn: string;
    readonly entities: number;
};

class ProductStore extends DataStore {
    products = this.collection(contractProductSchema).create();
}

const stores: ProductStore[] = [];

const openStore = () => {
    const store = new ProductStore(memoryBackend.create());
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

const readBaseline = (): Baseline | null => {
    if (fs.existsSync(BASELINE_FILE) === false) {
        return null;
    }

    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Partial<Baseline>;

    // A baseline recorded before the ratio existed holds rates only. Comparing a ratio
    // against a rate would produce a number with no meaning and fail every run, so it is
    // treated as absent and re-recorded.
    if (baseline.insertRatio == null || baseline.readRatio == null) {
        return null;
    }

    return baseline as Baseline;
};

/** Ratios are dimensionless and small; four places is enough to read and to compare. */
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

const rate = (operations: number, milliseconds: number) =>
    milliseconds <= 0 ? Infinity : Math.round((operations / milliseconds) * 1000);

/**
 * A fixed workload with no Routier in it, used as the unit the real measurements are
 * expressed in.
 *
 * `Map` set/get was chosen because it is the cheapest thing that still touches the two
 * resources contention actually takes away — CPU and the allocator — and because it cannot
 * regress with the library. `performance.now()` rather than `Date.now()`: this is tens of
 * milliseconds, where a millisecond-resolution clock is a visible term.
 */
const measureReference = () => {
    const map = new Map<string, { n: number }>();
    const startedAt = performance.now();

    for (let i = 0; i < REFERENCE_OPERATIONS; i++) {
        map.set(`reference-${i}`, { n: i });
    }

    let total = 0;

    for (let i = 0; i < REFERENCE_OPERATIONS; i++) {
        total += map.get(`reference-${i}`)!.n;
    }

    const elapsed = performance.now() - startedAt;

    // Consumes `total` so the read loop cannot be optimised away, without asserting a value
    // that would make this a test of arithmetic.
    if (total < 0) {
        throw new Error('unreachable');
    }

    return rate(REFERENCE_OPERATIONS * 2, elapsed);
};

/** Inserts `ENTITIES` rows in batches and returns the store plus the rate achieved. */
const measureInserts = async () => {
    const store = openStore();
    const batchSize = 1_000;
    const batches = Array.from({ length: ENTITIES / batchSize }, (_, batch) =>
        Array.from({ length: batchSize }, (_, i) => ({
            name: `product-${batch * batchSize + i}`,
            category: `category-${i % 25}`,
            price: i % 1000,
        }))
    );

    const startedAt = Date.now();

    for (const batch of batches) {
        await store.products.addAsync(...(batch as any[]));
        await store.saveChangesAsync();
    }

    return { store, insertsPerSecond: rate(ENTITIES, Date.now() - startedAt) };
};

const measureReads = async (store: ProductStore) => {
    const startedAt = Date.now();
    const rows = await store.products.toArrayAsync();

    return { rows: rows.length, readsPerSecond: rate(ENTITIES, Date.now() - startedAt) };
};

stressDescribe('S9 throughput floor', () => {
    stressIt(
        `memory: inserts and reads at ${ENTITIES.toLocaleString('en-US')} entities stay above ${FLOOR * 100}% of baseline`,
        {
            seed: 20260809,
            scale: { backend: memoryBackend.name, entities: ENTITIES, rounds: ROUNDS, floor: `${FLOOR * 100}%` },
        },
        async ({ note }) => {
            let bestInserts = 0;
            let bestReads = 0;
            let bestInsertRatio = 0;
            let bestReadRatio = 0;
            let bestReference = 0;

            for (let round = 0; round < ROUNDS; round++) {
                // Measured first and in the same round, so it carries the same contention
                // the two measurements below are about to see.
                const referencePerSecond = measureReference();

                const { store, insertsPerSecond } = await measureInserts();
                const { rows, readsPerSecond } = await measureReads(store);

                // A read rate measured over the wrong number of rows means nothing.
                expect(rows).toBe(ENTITIES);

                bestInserts = Math.max(bestInserts, insertsPerSecond);
                bestReads = Math.max(bestReads, readsPerSecond);
                bestReference = Math.max(bestReference, referencePerSecond);
                bestInsertRatio = Math.max(bestInsertRatio, insertsPerSecond / referencePerSecond);
                bestReadRatio = Math.max(bestReadRatio, readsPerSecond / referencePerSecond);

                note(
                    `round ${round}: ${insertsPerSecond.toLocaleString('en-US')} inserts/s, ` +
                    `${readsPerSecond.toLocaleString('en-US')} reads/s, ` +
                    `reference ${referencePerSecond.toLocaleString('en-US')} ops/s`
                );
            }

            const baseline = readBaseline();

            if (baseline == null) {
                // First run on this checkout: record and pass. There is nothing to compare
                // against, and inventing a threshold would be worse than admitting that.
                // The file is meant to be committed — a baseline regenerated on every CI
                // machine is not a floor, it is a mirror.
                fs.writeFileSync(
                    BASELINE_FILE,
                    `${JSON.stringify(
                        {
                            insertRatio: round4(bestInsertRatio),
                            readRatio: round4(bestReadRatio),
                            insertsPerSecond: bestInserts,
                            readsPerSecond: bestReads,
                            referenceOperationsPerSecond: bestReference,
                            recordedOn: new Date().toISOString(),
                            entities: ENTITIES,
                        } satisfies Baseline,
                        null,
                        4
                    )}\n`
                );

                note(`no usable baseline found — recorded ratios ${round4(bestInsertRatio)} (insert) and ${round4(bestReadRatio)} (read) to ${path.basename(BASELINE_FILE)}. Commit it.`);
                return;
            }

            const insertFloor = baseline.insertRatio * FLOOR;
            const readFloor = baseline.readRatio * FLOOR;

            note(
                `best of ${ROUNDS}: insert ratio ${round4(bestInsertRatio)} (floor ${round4(insertFloor)}, ` +
                `baseline ${baseline.insertRatio} from ${baseline.recordedOn}) — ` +
                `${bestInserts.toLocaleString('en-US')} inserts/s against a ${bestReference.toLocaleString('en-US')} ops/s reference`
            );
            note(
                `best of ${ROUNDS}: read ratio ${round4(bestReadRatio)} (floor ${round4(readFloor)}, ` +
                `baseline ${baseline.readRatio}) — ${bestReads.toLocaleString('en-US')} reads/s`
            );

            expect(
                bestInsertRatio >= insertFloor
                    ? 'inserts above floor'
                    : `insert ratio collapsed to ${round4(bestInsertRatio)}, floor is ${round4(insertFloor)} ` +
                    `(${bestInserts.toLocaleString('en-US')} inserts/s against a ${bestReference.toLocaleString('en-US')} ops/s reference, ` +
                    `so the machine is not the explanation)`
            ).toBe('inserts above floor');

            expect(
                bestReadRatio >= readFloor
                    ? 'reads above floor'
                    : `read ratio collapsed to ${round4(bestReadRatio)}, floor is ${round4(readFloor)} ` +
                    `(${bestReads.toLocaleString('en-US')} reads/s against a ${bestReference.toLocaleString('en-US')} ops/s reference)`
            ).toBe('reads above floor');
        }
    );
});
