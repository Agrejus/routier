import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { toExpression } from '@routier/core/expressions';
import { compare, formatTable, measure, type Measurement, type Scenario } from './harness.js';

/**
 * Performance regression gates.
 *
 * Scenarios cover the operations the perf work optimized — insert, update, full scan,
 * filtered query, point lookup by key — plus parser throughput, which used to be asserted
 * with a wall-clock bound inside parser.test.ts. That assertion flaked (0.535ms against a
 * 0.5ms bound) because one timing inside a unit test measures machine load as much as code.
 * It belongs here, against a median of 30 samples and a percentage tolerance.
 *
 *   npm run benchmark              compare against baselines, fail on regression
 *   npm run benchmark:update       rewrite baselines from this run
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const baselineFile = path.join(here, '..', 'baselines', 'baselines.json');

/** Fractional slowdown tolerated before a scenario fails the run. */
const TOLERANCE = 0.15;

const productSchema = s.define('bench_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    inStock: s.boolean(),
}).compile();

class BenchStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

class DiffBenchStore extends DataStore {
    products = this.collection(productSchema).diff().create();
}

/**
 * Same shape as `productSchema`, but every non-key property is stored under a different name.
 *
 * Renames put reads on a different copier: stored records are in the storage shape, so the
 * cloner generated from in-memory names cannot read them. That path used to fall back to
 * `structuredClone` and no scenario covered it.
 */
const renamedProductSchema = s.define('bench_renamed_products', {
    _id: s.string().key().identity(),
    name: s.string().from('product_name'),
    category: s.string().from('product_category'),
    price: s.number().from('unit_price'),
    inStock: s.boolean().from('in_stock'),
}).compile();

class RenamedBenchStore extends DataStore {
    products = this.collection(renamedProductSchema).proxy().create();
}

let storeCounter = 0;
// Every store constructed during a run, so main() can dispose them. A DataStore opens a
// broadcast-channel port pair per collection AT CONSTRUCTION, so an undisposed store holds
// the event loop open and the process never exits after printing its results.
const openStores: BenchStore[] = [];

const newStore = () => {
    const store = new BenchStore(new MemoryPlugin(`bench-${storeCounter++}`));
    openStores.push(store);
    return store;
};

const newDiffStore = () => {
    const store = new DiffBenchStore(new MemoryPlugin(`bench-diff-${storeCounter++}`));
    openStores.push(store as unknown as BenchStore);
    return store;
};

const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        name: `product-${i}`,
        category: i % 3 === 0 ? 'tools' : 'toys',
        price: i % 100,
        inStock: i % 2 === 0,
    }));

/** A store already holding `count` rows, for read benchmarks. */
async function seeded(count: number) {
    const store = newStore();
    await store.products.addAsync(...(rows(count) as any));
    await store.saveChangesAsync();
    return store;
}

const newRenamedStore = () => {
    const store = new RenamedBenchStore(new MemoryPlugin(`bench-renamed-${storeCounter++}`));
    openStores.push(store as unknown as BenchStore);
    return store;
};

/** A store of renamed-property rows, for the storage-shape read benchmarks. */
async function seededRenamed(count: number) {
    const store = newRenamedStore();
    await store.products.addAsync(...(rows(count) as any));
    await store.saveChangesAsync();
    return store;
}

const SCENARIOS: Scenario[] = [
    {
        name: 'insert-1000',
        setup: () => newStore(),
        run: async (store: BenchStore) => {
            await store.products.addAsync(...(rows(1000) as any));
            await store.saveChangesAsync();
        },
    },
    {
        name: 'update-1000',
        setup: async () => {
            const store = await seeded(1000);
            return { store, all: await store.products.toArrayAsync() };
        },
        run: async ({ store, all }: any) => {
            for (const product of all) {
                product.price = product.price + 1;
            }
            await store.saveChangesAsync();
        },
    },
    {
        name: 'full-scan-10000',
        // Read-only: the fixture is shared so the benchmark measures the read, not reseeding.
        reuseSetup: true,
        setup: () => seeded(10_000),
        run: (store: BenchStore) => store.products.toArrayAsync(),
    },
    {
        name: 'filtered-query-10000',
        // Read-only: the fixture is shared so the benchmark measures the read, not reseeding.
        reuseSetup: true,
        setup: () => seeded(10_000),
        run: (store: BenchStore) => store.products.where(p => p.price > 50).toArrayAsync(),
    },
    {
        name: 'point-lookup-10000',
        // Read-only: the fixture is shared so the benchmark measures the read, not reseeding.
        reuseSetup: true,
        setup: async () => {
            const store = await seeded(10_000);
            const [first] = await store.products.take(1).toArrayAsync();
            return { store, id: first._id };
        },
        run: ({ store, id }: any) => store.products.where(([p, params]: [any, any]) => p._id === params.id, { id }).firstOrUndefinedAsync(),
    },
    {
        // The renamed-schema read path. Stored rows are in storage shape, so these reads use
        // the storage-shape cloner rather than the in-memory one.
        name: 'renamed-full-scan-10000',
        reuseSetup: true,
        setup: () => seededRenamed(10_000),
        run: (store: RenamedBenchStore) => store.products.toArrayAsync(),
    },
    {
        name: 'renamed-filtered-query-10000',
        reuseSetup: true,
        setup: () => seededRenamed(10_000),
        run: (store: RenamedBenchStore) => store.products.where(p => p.price > 50).toArrayAsync(),
    },
    {
        name: 'count-10000',
        // Read-only: the fixture is shared so the benchmark measures the read, not reseeding.
        reuseSetup: true,
        setup: () => seeded(10_000),
        run: (store: BenchStore) => store.products.countAsync(),
    },
    {
        // Diff tracking has no per-write cost; its price is paid at save time, when every
        // attachment is content-hashed against its baseline. This is that sweep with work
        // to find: every entity dirty.
        name: 'diff-update-1000',
        setup: async () => {
            const store = newDiffStore();
            await store.products.addAsync(...(rows(1000) as any));
            await store.saveChangesAsync();
            return { store, all: await store.products.toArrayAsync() };
        },
        run: async ({ store, all }: any) => {
            for (const product of all) {
                product.price = product.price + 1;
            }
            await store.saveChangesAsync();
        },
    },
    {
        // The same sweep with nothing to find — the fixed overhead every diff-mode save
        // pays just to learn that 10,000 clean attachments are clean.
        name: 'diff-clean-sweep-10000',
        reuseSetup: true,
        setup: async () => {
            const store = newDiffStore();
            await store.products.addAsync(...(rows(10_000) as any));
            await store.saveChangesAsync();
            await store.products.toArrayAsync();
            return store;
        },
        run: (store: DiffBenchStore) => store.hasChangesAsync(),
    },
    {
        name: 'parse-simple-filter',
        run: () => toExpression(productSchema as any, (p: any) => p.name === 'test'),
    },
    {
        name: 'parse-complex-filter',
        run: () => toExpression(
            productSchema as any,
            (p: any) =>
                (p.category === 'tools' && p.price > 100) ||
                (p.category === 'toys' && p.price < 50) ||
                (p.inStock === true && p.price >= 20 && p.price <= 200),
        ),
    },
    {
        name: 'compile-schema',
        run: () => s.define(`bench_compile_${storeCounter++}`, {
            id: s.string().key(),
            name: s.string(),
            nested: s.object({ value: s.string() }),
            tags: s.array(s.string()),
        }).compile(),
    },
];

async function main() {
    try {
        await runScenarios();
    } finally {
        // Release the channel ports every store opened, or the run hangs after the table.
        for (const store of openStores) {
            store[Symbol.dispose]();
        }
    }
}

async function runScenarios() {
    const updateBaseline = process.argv.includes('--update-baseline');

    const baselines: Record<string, number> = fs.existsSync(baselineFile)
        ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')).medians ?? {}
        : {};

    const measurements: Measurement[] = [];

    for (const scenario of SCENARIOS) {
        process.stdout.write(`running ${scenario.name}... `);
        const measurement = await measure(scenario, { warmup: 3, samples: 30 });
        measurements.push(measurement);
        process.stdout.write(`${measurement.medianMs.toFixed(3)}ms\n`);
    }

    if (updateBaseline) {
        const medians = Object.fromEntries(measurements.map(m => [m.name, Number(m.medianMs.toFixed(4))]));
        fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
        fs.writeFileSync(baselineFile, `${JSON.stringify({
            // Recorded so a surprising baseline can be traced to the machine that set it.
            recordedOn: { platform: process.platform, arch: process.arch, node: process.version },
            toleranceRatio: TOLERANCE,
            medians,
        }, null, 2)}\n`);
        console.log(`\nBaselines written to ${path.relative(process.cwd(), baselineFile)}`);
        return;
    }

    const comparisons = compare(measurements, baselines, TOLERANCE);
    console.log(`\n${formatTable(comparisons)}`);

    const regressed = comparisons.filter(c => c.regressed);

    if (regressed.length > 0) {
        console.error(
            `\n${regressed.length} scenario(s) regressed by more than ${(TOLERANCE * 100).toFixed(0)}%. ` +
            `If the change is intended, re-record with: npm run benchmark:update`
        );
        process.exitCode = 1;
        return;
    }

    console.log('\nNo regressions.');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
