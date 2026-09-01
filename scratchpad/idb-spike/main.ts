import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import { MemoryPlugin } from "@routier/memory-plugin";
import { OptimisticUpdatesDbPlugin, PluginSyncEngine } from "@routier/replication-plugin";

const itemSchema = s.define("items", {
    _id: s.string().key().identity(),
    name: s.string(),
    value: s.number(),
}).compile();

class ItemStore extends DataStore {
    items = this.collection(itemSchema).proxy().create();
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

const SINGLE_WRITES = 200;
const BULK_ROWS = 1000;
const READS = 200;
const SCANS = 20;

async function benchRoutierStore(makeStore: () => ItemStore) {
    const store = makeStore();

    const writes: number[] = [];
    for (let i = 0; i < SINGLE_WRITES; i++) {
        const t = performance.now();
        await store.items.addAsync({ name: `item ${i}`, value: i } as never);
        await store.saveChangesAsync();
        writes.push(performance.now() - t);
    }

    const bulkStart = performance.now();
    for (let i = 0; i < BULK_ROWS; i++) {
        await store.items.addAsync({ name: `bulk ${i}`, value: 10_000 + i } as never);
    }
    await store.saveChangesAsync();
    const bulkMs = +(performance.now() - bulkStart).toFixed(1);

    const reads: number[] = [];
    for (let i = 0; i < READS; i++) {
        const t = performance.now();
        await store.items.where(([x, p]) => x.value === p.v, { v: i }).firstOrUndefinedAsync();
        reads.push(performance.now() - t);
    }

    const scans: number[] = [];
    for (let i = 0; i < SCANS; i++) {
        const t = performance.now();
        await store.items.toArrayAsync();
        scans.push(performance.now() - t);
    }

    return {
        singleWriteAckMs: stats(writes),
        bulkInsertMs: bulkMs,
        readByValueMs: stats(reads),
        fullScanMs: stats(scans),
    };
}

type SpikeRow = { _id: string; name: string; value: number };

class SpikeStore {
    private readonly cache = new Map<string, SpikeRow>();
    private hydrated = false;
    private queue: SpikeRow[] = [];
    private flushing: Promise<void> | null = null;
    private readonly dbPromise: Promise<IDBDatabase>;

    constructor(dbName: string) {
        this.dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = () => req.result.createObjectStore("items", { keyPath: "_id" });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    add(record: Omit<SpikeRow, "_id">): SpikeRow {
        const row: SpikeRow = { _id: crypto.randomUUID(), ...record };
        this.cache.set(row._id, row);
        this.queue.push(row);
        this.scheduleFlush();
        return row;
    }

    private scheduleFlush() {
        if (this.flushing != null) {
            return;
        }

        this.flushing = (async () => {
            const db = await this.dbPromise;
            while (this.queue.length > 0) {
                const batch = this.queue;
                this.queue = [];
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction("items", "readwrite");
                    const os = tx.objectStore("items");
                    for (const row of batch) {
                        os.put(row);
                    }
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            }
            this.flushing = null;
        })();
    }

    async whenDurable() {
        while (this.flushing != null) {
            await this.flushing;
        }
    }

    async getById(id: string): Promise<SpikeRow | undefined> {
        const hit = this.cache.get(id);
        if (hit !== undefined) {
            return hit;
        }

        const db = await this.dbPromise;
        const row = await new Promise<SpikeRow | undefined>((resolve, reject) => {
            const req = db.transaction("items").objectStore("items").get(id);
            req.onsuccess = () => resolve(req.result as SpikeRow | undefined);
            req.onerror = () => reject(req.error);
        });

        if (row != null) {
            this.cache.set(row._id, row);
        }
        return row;
    }

    async find(predicate: (row: SpikeRow) => boolean): Promise<SpikeRow | undefined> {
        await this.ensureHydrated();
        for (const row of this.cache.values()) {
            if (predicate(row)) {
                return row;
            }
        }
        return undefined;
    }

    async toArray(): Promise<SpikeRow[]> {
        await this.ensureHydrated();
        return [...this.cache.values()];
    }

    private async ensureHydrated() {
        if (this.hydrated) {
            return;
        }

        const db = await this.dbPromise;
        const rows = await new Promise<SpikeRow[]>((resolve, reject) => {
            const req = db.transaction("items").objectStore("items").getAll();
            req.onsuccess = () => resolve(req.result as SpikeRow[]);
            req.onerror = () => reject(req.error);
        });

        for (const row of rows) {
            if (!this.cache.has(row._id)) {
                this.cache.set(row._id, row);
            }
        }
        this.hydrated = true;
    }
}

async function benchSpike(dbName: string) {
    const store = new SpikeStore(dbName);

    const writes: number[] = [];
    for (let i = 0; i < SINGLE_WRITES; i++) {
        const t = performance.now();
        store.add({ name: `item ${i}`, value: i });
        await Promise.resolve();
        writes.push(performance.now() - t);
    }

    const durableStart = performance.now();
    await store.whenDurable();
    const singleWritesDurableMs = +(performance.now() - durableStart).toFixed(1);

    const bulkStart = performance.now();
    for (let i = 0; i < BULK_ROWS; i++) {
        store.add({ name: `bulk ${i}`, value: 10_000 + i });
    }
    const bulkAckMs = +(performance.now() - bulkStart).toFixed(3);
    await store.whenDurable();
    const bulkDurableMs = +(performance.now() - bulkStart).toFixed(1);

    const reads: number[] = [];
    for (let i = 0; i < READS; i++) {
        const t = performance.now();
        await store.find((row) => row.value === i);
        reads.push(performance.now() - t);
    }

    const scans: number[] = [];
    for (let i = 0; i < SCANS; i++) {
        const t = performance.now();
        await store.toArray();
        scans.push(performance.now() - t);
    }

    const coldStore = new SpikeStore(dbName);
    const coldStart = performance.now();
    const coldRow = await coldStore.find((row) => row.value === 42);
    const coldFirstReadMs = +(performance.now() - coldStart).toFixed(3);

    const warmAfterColdStart = performance.now();
    await coldStore.getById(coldRow!._id);
    const warmByIdMs = +(performance.now() - warmAfterColdStart).toFixed(3);

    return {
        singleWriteAckMs: stats(writes),
        singleWritesDurableMs,
        bulkAckMs,
        bulkDurableMs,
        readByValueMs: stats(reads),
        fullScanMs: stats(scans),
        coldHydratingFirstReadMs: coldFirstReadMs,
        warmByIdAfterColdMs: warmByIdMs,
    };
}

const SCALE_ROWS = 50_000;
const SCALE_BY_ID_READS = 100;
const SCALE_FILTERED_READS = 20;
const SCALE_SCANS = 3;

async function benchRoutierScale(makeStore: () => ItemStore) {
    const store = makeStore();

    const seedStart = performance.now();
    for (let i = 0; i < SCALE_ROWS; i++) {
        await store.items.addAsync({ name: `item ${i}`, value: i } as never);
    }
    await store.saveChangesAsync();
    const seedMs = +(performance.now() - seedStart).toFixed(0);

    const seeded = await store.items.toArrayAsync();
    const ids = Array.from({ length: SCALE_BY_ID_READS }, () => (seeded[Math.floor(Math.random() * seeded.length)] as SpikeRow)._id);

    const byId: number[] = [];
    for (const id of ids) {
        const t = performance.now();
        await store.items.where(([x, p]) => x._id === p.id, { id }).firstOrUndefinedAsync();
        byId.push(performance.now() - t);
    }

    const filtered: number[] = [];
    for (let i = 0; i < SCALE_FILTERED_READS; i++) {
        const t = performance.now();
        await store.items.where(([x, p]) => x.value === p.v, { v: i * 100 }).firstOrUndefinedAsync();
        filtered.push(performance.now() - t);
    }

    const scans: number[] = [];
    for (let i = 0; i < SCALE_SCANS; i++) {
        const t = performance.now();
        await store.items.toArrayAsync();
        scans.push(performance.now() - t);
    }

    const writes: number[] = [];
    for (let i = 0; i < 50; i++) {
        const t = performance.now();
        await store.items.addAsync({ name: `post ${i}`, value: SCALE_ROWS + i } as never);
        await store.saveChangesAsync();
        writes.push(performance.now() - t);
    }

    return {
        seedMs,
        readByIdMs: stats(byId),
        readFilteredMs: stats(filtered),
        fullScanMs: stats(scans),
        singleWriteAckMs: stats(writes),
    };
}

async function benchSpikeScale(dbName: string) {
    const store = new SpikeStore(dbName);

    const seedStart = performance.now();
    const rows: SpikeRow[] = [];
    for (let i = 0; i < SCALE_ROWS; i++) {
        rows.push(store.add({ name: `item ${i}`, value: i }));
    }
    const seedAckMs = +(performance.now() - seedStart).toFixed(0);
    await store.whenDurable();
    const seedDurableMs = +(performance.now() - seedStart).toFixed(0);

    const ids = Array.from({ length: SCALE_BY_ID_READS }, () => rows[Math.floor(Math.random() * rows.length)]._id);

    const byId: number[] = [];
    for (const id of ids) {
        const t = performance.now();
        await store.getById(id);
        byId.push(performance.now() - t);
    }

    const filtered: number[] = [];
    for (let i = 0; i < SCALE_FILTERED_READS; i++) {
        const t = performance.now();
        await store.find((row) => row.value === i * 100);
        filtered.push(performance.now() - t);
    }

    const scans: number[] = [];
    for (let i = 0; i < SCALE_SCANS; i++) {
        const t = performance.now();
        await store.toArray();
        scans.push(performance.now() - t);
    }

    const writes: number[] = [];
    for (let i = 0; i < 50; i++) {
        const t = performance.now();
        store.add({ name: `post ${i}`, value: SCALE_ROWS + i });
        await Promise.resolve();
        writes.push(performance.now() - t);
    }
    await store.whenDurable();

    const coldStore = new SpikeStore(dbName);
    const coldStart = performance.now();
    await coldStore.find((row) => row.value === 42);
    const coldHydrateMs = +(performance.now() - coldStart).toFixed(1);

    const coldByIdStore = new SpikeStore(dbName);
    const coldByIdStart = performance.now();
    await coldByIdStore.getById(ids[0]);
    const coldByIdMs = +(performance.now() - coldByIdStart).toFixed(3);

    return {
        seedAckMs,
        seedDurableMs,
        readByIdMs: stats(byId),
        readFilteredMs: stats(filtered),
        fullScanMs: stats(scans),
        singleWriteAckMs: stats(writes),
        coldHydrateFullMs: coldHydrateMs,
        coldByIdNoHydrateMs: coldByIdMs,
    };
}

async function runScale() {
    const runId = Date.now();

    const syncEngine = await benchRoutierScale(
        () => new ItemStore(new PluginSyncEngine({
            source: new MemoryPlugin(`scale-engine-mem-${runId}`),
            mirrorPlugins: [new DexiePlugin(`scale-engine-idb-${runId}`)],
            persistAckMode: "after-source",
        }))
    );

    const memoryDirect = await benchRoutierScale(
        () => new ItemStore(new MemoryPlugin(`scale-mem-${runId}`))
    );

    const spike = await benchSpikeScale(`scale-spike-${runId}`);

    return { rows: SCALE_ROWS, syncEngine, memoryDirect, spike };
}

(window as unknown as Record<string, unknown>).runScale = runScale;

async function runOptimistic() {
    const dbName = `opt-${Date.now()}`;

    const seedStore = new ItemStore(new OptimisticUpdatesDbPlugin(new DexiePlugin(dbName)));
    for (let i = 0; i < SCALE_ROWS; i++) {
        await seedStore.items.addAsync({ name: `item ${i}`, value: i } as never);
    }
    await seedStore.saveChangesAsync();

    const checkStore = new ItemStore(new DexiePlugin(dbName));
    for (let attempt = 0; attempt < 600; attempt++) {
        const rows = await checkStore.items.toArrayAsync();
        if (rows.length >= SCALE_ROWS) {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const store = new ItemStore(new OptimisticUpdatesDbPlugin(new DexiePlugin(dbName)));

    const coldStart = performance.now();
    const coldRow = await store.items.where(([x, p]) => x.value === p.v, { v: 42 }).firstOrUndefinedAsync();
    const coldFirstReadMs = +(performance.now() - coldStart).toFixed(1);

    const byId: number[] = [];
    for (let i = 0; i < SCALE_BY_ID_READS; i++) {
        const t = performance.now();
        await store.items.where(([x, p]) => x._id === p.id, { id: (coldRow as SpikeRow)._id }).firstOrUndefinedAsync();
        byId.push(performance.now() - t);
    }

    const filtered: number[] = [];
    for (let i = 0; i < SCALE_FILTERED_READS; i++) {
        const t = performance.now();
        await store.items.where(([x, p]) => x.value === p.v, { v: i * 100 }).firstOrUndefinedAsync();
        filtered.push(performance.now() - t);
    }

    const scans: number[] = [];
    for (let i = 0; i < SCALE_SCANS; i++) {
        const t = performance.now();
        await store.items.toArrayAsync();
        scans.push(performance.now() - t);
    }

    const writes: number[] = [];
    for (let i = 0; i < 50; i++) {
        const t = performance.now();
        await store.items.addAsync({ name: `post ${i}`, value: SCALE_ROWS + i } as never);
        await store.saveChangesAsync();
        writes.push(performance.now() - t);
    }

    return {
        rows: SCALE_ROWS,
        coldFirstReadHydratingMs: coldFirstReadMs,
        readByIdMs: stats(byId),
        readFilteredMs: stats(filtered),
        fullScanMs: stats(scans),
        singleWriteAckMs: stats(writes),
    };
}

(window as unknown as Record<string, unknown>).runOptimistic = runOptimistic;

async function runBench() {
    const runId = Date.now();

    const dexieDirect = await benchRoutierStore(
        () => new ItemStore(new DexiePlugin(`bench-dexie-${runId}`))
    );

    const syncEngine = await benchRoutierStore(
        () => new ItemStore(new PluginSyncEngine({
            source: new MemoryPlugin(`bench-engine-mem-${runId}`),
            mirrorPlugins: [new DexiePlugin(`bench-engine-idb-${runId}`)],
            persistAckMode: "after-source",
        }))
    );

    const memoryDirect = await benchRoutierStore(
        () => new ItemStore(new MemoryPlugin(`bench-mem-${runId}`))
    );

    const spike = await benchSpike(`bench-spike-${runId}`);

    return {
        rows: { singleWrites: SINGLE_WRITES, bulk: BULK_ROWS, reads: READS, scans: SCANS },
        dexieDirect,
        syncEngine,
        memoryDirect,
        spike,
    };
}

(window as unknown as Record<string, unknown>).runBench = runBench;
