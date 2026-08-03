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
 */

const ENTITIES = 10_000;
const ROUNDS = 3;
/** Fraction of the recorded baseline a measurement must clear. */
const FLOOR = 0.5;

const BASELINE_FILE = path.join(__dirname, 'throughput-baseline.json');

type Baseline = {
    /** Operations per second, recorded on the first run and committed. */
    readonly insertsPerSecond: number;
    readonly readsPerSecond: number;
    /** Context for a human reading a failure — never compared against. */
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

    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
};

const rate = (operations: number, milliseconds: number) =>
    milliseconds <= 0 ? Infinity : Math.round((operations / milliseconds) * 1000);

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

            for (let round = 0; round < ROUNDS; round++) {
                const { store, insertsPerSecond } = await measureInserts();
                const { rows, readsPerSecond } = await measureReads(store);

                // A read rate measured over the wrong number of rows means nothing.
                expect(rows).toBe(ENTITIES);

                bestInserts = Math.max(bestInserts, insertsPerSecond);
                bestReads = Math.max(bestReads, readsPerSecond);

                note(`round ${round}: ${insertsPerSecond.toLocaleString('en-US')} inserts/s, ${readsPerSecond.toLocaleString('en-US')} reads/s`);
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
                            insertsPerSecond: bestInserts,
                            readsPerSecond: bestReads,
                            recordedOn: new Date().toISOString(),
                            entities: ENTITIES,
                        } satisfies Baseline,
                        null,
                        4
                    )}\n`
                );

                note(`no baseline found — recorded ${bestInserts.toLocaleString('en-US')} inserts/s and ${bestReads.toLocaleString('en-US')} reads/s to ${path.basename(BASELINE_FILE)}. Commit it.`);
                return;
            }

            const insertFloor = Math.round(baseline.insertsPerSecond * FLOOR);
            const readFloor = Math.round(baseline.readsPerSecond * FLOOR);

            note(
                `best of ${ROUNDS}: ${bestInserts.toLocaleString('en-US')} inserts/s (floor ${insertFloor.toLocaleString('en-US')}, ` +
                `baseline ${baseline.insertsPerSecond.toLocaleString('en-US')} from ${baseline.recordedOn})`
            );
            note(
                `best of ${ROUNDS}: ${bestReads.toLocaleString('en-US')} reads/s (floor ${readFloor.toLocaleString('en-US')}, ` +
                `baseline ${baseline.readsPerSecond.toLocaleString('en-US')})`
            );

            expect(
                bestInserts >= insertFloor
                    ? 'inserts above floor'
                    : `inserts collapsed to ${bestInserts.toLocaleString('en-US')}/s, floor is ${insertFloor.toLocaleString('en-US')}/s`
            ).toBe('inserts above floor');

            expect(
                bestReads >= readFloor
                    ? 'reads above floor'
                    : `reads collapsed to ${bestReads.toLocaleString('en-US')}/s, floor is ${readFloor.toLocaleString('en-US')}/s`
            ).toBe('reads above floor');
        }
    );
});
