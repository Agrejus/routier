import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";

const orderSchema = s.define("orders", {
    _id: s.string().key().identity(),
    email: s.string(),
    region: s.string("na", "eu", "apac"),
    status: s.string("pending", "paid", "shipped"),
    amount: s.number(),
    notes: s.string(),
    createdAt: s.date().default(() => new Date()),
}).compile();

class OrderStore extends DataStore {
    orders = this.collection(orderSchema).proxy().create();
}

type Stats = { n: number; mean: number; p50: number; p95: number; max: number };

const stats = (samples: number[]): Stats => {
    const sorted = [...samples].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return {
        n: sorted.length,
        mean: +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(3),
        p50: +at(0.5).toFixed(3),
        p95: +at(0.95).toFixed(3),
        max: +sorted[sorted.length - 1].toFixed(3),
    };
};

const SEED_ROWS = 4000;
const SEED_BATCH = 1000;
const ITERATIONS = 30;

const REGIONS = ["na", "eu", "apac"] as const;
const STATUSES = ["pending", "paid", "shipped"] as const;

const measure = async (iterations: number, run: () => Promise<unknown>) => {
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const t = performance.now();
        await run();
        samples.push(performance.now() - t);
    }
    return stats(samples);
};

async function runBench() {
    const store = new OrderStore(new DexiePlugin(`dexie-bench-${Date.now()}`));

    const seedStart = performance.now();
    for (let batch = 0; batch < SEED_ROWS / SEED_BATCH; batch++) {
        for (let i = 0; i < SEED_BATCH; i++) {
            const n = batch * SEED_BATCH + i;
            await store.orders.addAsync({
                email: `user${n}@example.com`,
                region: REGIONS[n % 3],
                status: STATUSES[n % 3],
                amount: +(Math.random() * 1000).toFixed(2),
                notes: `order number ${n} with some text payload attached`,
            } as never);
        }
        await store.saveChangesAsync();
    }
    const seedMs = +(performance.now() - seedStart).toFixed(0);

    const countAll = await measure(ITERATIONS, () => store.orders.countAsync());

    const readAll = await measure(ITERATIONS, () => store.orders.toArrayAsync());

    const filterEqIndexed = await measure(ITERATIONS, () =>
        store.orders.where(([x, p]) => x.status === p.s, { s: "paid" }).toArrayAsync());

    const filterCompound = await measure(ITERATIONS, () =>
        store.orders.where(([x, p]) => x.status === p.s && x.region === p.r, { s: "pending", r: "eu" }).toArrayAsync());

    const findOneByEmail = await measure(ITERATIONS, () =>
        store.orders.where(([x, p]) => x.email === p.e, { e: "user2500@example.com" }).firstOrUndefinedAsync());

    const sumPaid = await measure(ITERATIONS, () =>
        store.orders.where(([x, p]) => x.status === p.s, { s: "paid" }).sumAsync(x => x.amount));

    const page = await measure(ITERATIONS, () =>
        store.orders.sort(x => x.createdAt).skip(1000).take(25).toArrayAsync());

    const { explanation } = await store.orders
        .where(([x, p]) => x.status === p.s, { s: "paid" })
        .explain()
        .toArrayAsync();

    return {
        seedRows: SEED_ROWS,
        seedMs,
        countAllMs: countAll,
        readAllMs: readAll,
        filterEqIndexedMs: filterEqIndexed,
        filterCompoundMs: filterCompound,
        findOneByEmailMs: findOneByEmail,
        sumPaidMs: sumPaid,
        pageMs: page,
        explanation,
    };
}

(window as unknown as Record<string, unknown>).runBench = runBench;
