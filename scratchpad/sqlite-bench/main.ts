import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { SqliteDbPlugin, wasmDriver } from "@routier/sqlite-plugin";

const orderSchema = s.define("orders", {
    _id: s.string().key().identity(),
    customer: s.string().index("idx_customer"),
    amount: s.number().index("idx_amount"),
    status: s.string("pending", "paid", "shipped"),
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
const SINGLE_WRITES = 100;
const BY_ID_READS = 200;
const FILTERED_READS = 100;
const FALLBACK_READS = 20;
const SCANS = 10;

const STATUSES = ["pending", "paid", "shipped"] as const;

async function runBench() {
    const runId = Date.now();
    let storage: "opfs" | "memory" = "opfs";
    let store: OrderStore;

    const build = (mode: "opfs" | "memory") => new OrderStore(new SqliteDbPlugin(`bench-${runId}.db`, {
        driver: wasmDriver({ storage: mode, workerUrl: "/wasmWorker.js" }),
    }));

    console.log("building store (opfs)");
    try {
        store = build("opfs");
        await store.orders.toArrayAsync();
    } catch (error) {
        console.log(`opfs unavailable (${String(error)}), falling back to memory storage`);
        storage = "memory";
        store = build("memory");
        await store.orders.toArrayAsync();
    }
    console.log(`store ready, storage=${storage}, seeding ${SEED_ROWS} rows`);

    const seedStart = performance.now();
    for (let batch = 0; batch < SEED_ROWS / SEED_BATCH; batch++) {
        for (let i = 0; i < SEED_BATCH; i++) {
            const n = batch * SEED_BATCH + i;
            await store.orders.addAsync({
                customer: `customer ${n % 200}`,
                amount: +(Math.random() * 1000).toFixed(2),
                status: STATUSES[n % 3],
                notes: `order number ${n} with some text payload attached`,
            } as never);
        }
        await store.saveChangesAsync();
        console.log(`seeded batch ${batch + 1}, ${(performance.now() - seedStart).toFixed(0)}ms elapsed`);
    }
    const seedMs = +(performance.now() - seedStart).toFixed(0);

    const seeded = await store.orders.toArrayAsync();
    const ids = Array.from({ length: BY_ID_READS }, () =>
        (seeded[Math.floor(Math.random() * seeded.length)] as { _id: string })._id);

    const writes: number[] = [];
    for (let i = 0; i < SINGLE_WRITES; i++) {
        const t = performance.now();
        await store.orders.addAsync({
            customer: `late customer ${i}`,
            amount: i,
            status: "pending",
            notes: `late order ${i}`,
        } as never);
        await store.saveChangesAsync();
        writes.push(performance.now() - t);
    }

    const byId: number[] = [];
    for (const id of ids) {
        const t = performance.now();
        await store.orders.where(([x, p]) => x._id === p.id, { id }).firstOrUndefinedAsync();
        byId.push(performance.now() - t);
    }

    const filtered: number[] = [];
    for (let i = 0; i < FILTERED_READS; i++) {
        const t = performance.now();
        await store.orders.where(([x, p]) => x.amount > p.v && x.status === p.s, { v: 990 - i, s: "paid" }).toArrayAsync();
        filtered.push(performance.now() - t);
    }

    const fallback: number[] = [];
    for (let i = 0; i < FALLBACK_READS; i++) {
        const t = performance.now();
        await store.orders.where(([x, p]) => Math.abs(x.amount - p.v) < 0.5, { v: i * 10 }).toArrayAsync();
        fallback.push(performance.now() - t);
    }

    const scans: number[] = [];
    for (let i = 0; i < SCANS; i++) {
        const t = performance.now();
        await store.orders.toArrayAsync();
        scans.push(performance.now() - t);
    }

    return {
        storage,
        seedRows: SEED_ROWS,
        seedMs,
        singleWriteAckMs: stats(writes),
        readByIdMs: stats(byId),
        readFilteredIndexedMs: stats(filtered),
        readFallbackMemoryMs: stats(fallback),
        fullScanMs: stats(scans),
    };
}

(window as unknown as Record<string, unknown>).runBench = runBench;
