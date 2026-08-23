import { QueryExplanation } from '@routier/core/plugins';
import { createPlugin, DbChoice, ShopStore } from './store';
import { makeOrders } from './seed';
import { explainFilter, OPS, OpContext } from './ops';
import { migrate } from './migrate';

export type Timing = { step: string; ms: number; note?: string };

export type Visit = {
    db: DbChoice;
    /** How this database got its data: seeded fresh, or migrated from the previous stop. */
    arrival: Timing;
    timings: Timing[];
    /** The filter op's query plan on this database: pushdown analysis + what the plugin executed. */
    explanation: QueryExplanation;
};

const CHUNK = 1000;

async function time(step: string, fn: () => Promise<string | number | void>): Promise<Timing> {
    const start = performance.now();
    const note = await fn();
    const ms = Math.round((performance.now() - start) * 10) / 10;
    return { step, ms, ...(note != null ? { note: String(note) } : {}) };
}

export class Journey {
    private stores = new Map<DbChoice, ShopStore>();
    private readonly stamp = Date.now();
    private readonly ctx: OpContext;
    current: DbChoice | null = null;

    constructor(public readonly count: number, private readonly skipOps: string[] = []) {
        const orders = makeOrders(count);
        this.ctx = { email: orders[Math.floor(orders.length / 2)].email };
    }

    private open(db: DbChoice): ShopStore {
        let store = this.stores.get(db);
        if (store == null) {
            store = new ShopStore(createPlugin(db, `shop-${this.stamp}-${db}`));
            this.stores.set(db, store);
            (window as any).__STORES__ = this.stores;
        }
        return store;
    }

    /** Step 1: seed the starting database. */
    async start(db: DbChoice, onProgress: (m: string) => void): Promise<Visit> {
        const store = this.open(db);
        const orders = makeOrders(this.count);

        onProgress(`Seeding ${this.count.toLocaleString()} orders...`);
        const arrival = await time(`Seeded ${this.count.toLocaleString()} orders`, async () => {
            for (let i = 0; i < orders.length; i += CHUNK) {
                await store.orders.addAsync(...orders.slice(i, i + CHUNK));
                await store.saveChangesAsync();
            }
        });

        this.current = db;
        return { db, arrival, timings: await this.runOps(store, onProgress), explanation: (await explainFilter(store)).explanation };
    }

    /** Step 2..n: select all from the current database, insert into the next. */
    async migrateTo(db: DbChoice, onProgress: (m: string) => void): Promise<Visit> {
        const source = this.open(this.current!);
        const target = this.open(db);

        onProgress(`Migrating ${this.current} -> ${db}...`);
        const arrival = await time(`Migrated from ${this.current}`, async () => {
            const copied = await migrate(source, target);
            return `${copied.toLocaleString()} rows copied`;
        });

        this.current = db;
        return { db, arrival, timings: await this.runOps(target, onProgress), explanation: (await explainFilter(target)).explanation };
    }

    /** Release every store and remove its backing database. Benchmark runs use fresh names, so
     * keeping them open would eventually exhaust SQLite's finite OPFS SAH handle pool. */
    async destroyAsync(): Promise<void> {
        for (const store of this.stores.values()) {
            await store.destroyAsync();
        }
        this.stores.clear();
        this.current = null;
    }

    private async runOps(store: ShopStore, onProgress: (m: string) => void): Promise<Timing[]> {
        const timings: Timing[] = [];
        for (const op of OPS) {
            if (this.skipOps.some(s => op.name.toLowerCase().includes(s.toLowerCase()))) continue;
            onProgress(op.name);
            timings.push(await time(op.name, () => op.run(store, this.ctx)));
            if ('cleanup' in op && op.cleanup != null) {
                await op.cleanup(store);
            }
        }
        return timings;
    }
}
