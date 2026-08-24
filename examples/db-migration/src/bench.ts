import { QueryExplanation } from '@routier/core/plugins';
import { createPlugin, databaseNameFor, DbChoice, removeStalePGliteDatabases, ShopStore } from './store';
import { makeSeed } from './seed';
import { explainFilter, OPS, OpContext } from './ops';
import { migrate } from './migrate';

export type Timing = { step: string; ms: number; note?: string };

export type Visit = {
    db: DbChoice;
    /**
     * Opening the engine and getting one statement answered, on an empty database.
     *
     * Kept out of `arrival` and out of the totals: it is paid once per database, not per row, so
     * adding it to a throughput number would hide both. It is the whole cost for an engine that
     * boots a server — PGlite builds a PostgreSQL installation here, where SQLite opens a file.
     */
    coldStart: Timing;
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

    private readonly seed: ReturnType<typeof makeSeed>;

    constructor(public readonly count: number, private readonly skipOps: string[] = []) {
        this.seed = makeSeed(count);
        const orders = this.seed.orders;
        this.ctx = { email: String(orders[Math.floor(orders.length / 2)].email) };
    }

    private open(db: DbChoice): ShopStore {
        let store = this.stores.get(db);
        if (store == null) {
            store = new ShopStore(createPlugin(db, databaseNameFor(this.stamp, db)));
            this.stores.set(db, store);
            (window as any).__STORES__ = this.stores;
        }
        return store;
    }

    /** Step 1: seed the starting database. */
    async start(db: DbChoice, onProgress: (m: string) => void): Promise<Visit> {
        await removeStalePGliteDatabases(databaseNameFor(this.stamp, 'pglite'));

        onProgress('Opening the database...');
        const coldStart = await this.timeColdStart(db, onProgress);

        const store = this.open(db);
        const collections = new Map(store.all().map(({ name, collection }) => [name, collection]));

        const arrival = await time(`Seeded ${this.count.toLocaleString()} documents`, async () => {
            for (const [name, rows] of Object.entries(this.seed)) {
                onProgress(`Seeding ${rows.length.toLocaleString()} ${name}...`);
                const collection = collections.get(name)!;

                for (let i = 0; i < rows.length; i += CHUNK) {
                    await collection.addAsync(...rows.slice(i, i + CHUNK));
                    await store.saveChangesAsync();
                }
            }

            return `${Object.keys(this.seed).length} collections`;
        });

        this.current = db;
        return { db, coldStart, arrival, timings: await this.runOps(store, onProgress), explanation: (await explainFilter(store)).explanation };
    }

    /** Step 2..n: select all from the current database, insert into the next. */
    async migrateTo(db: DbChoice, onProgress: (m: string) => void): Promise<Visit> {
        const source = this.open(this.current!);

        onProgress('Opening the database...');
        const coldStart = await this.timeColdStart(db, onProgress);

        const target = this.open(db);

        onProgress(`Migrating ${this.current} -> ${db}...`);
        const arrival = await time(`Migrated from ${this.current}`, async () => {
            const copied = await migrate(source, target);
            return `${copied.toLocaleString()} rows copied`;
        });

        this.current = db;
        return { db, coldStart, arrival, timings: await this.runOps(target, onProgress), explanation: (await explainFilter(target)).explanation };
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

    /**
     * The first statement against a database that has nothing in it yet.
     *
     * A count rather than a write, so the measurement does not touch the data every other
     * timing is taken against. It still pays for what a first statement pays for: starting the
     * engine, and the lazy `CREATE TABLE` the SQL plugins do on first use.
     */
    private timeColdStart(db: DbChoice, onProgress: (m: string) => void): Promise<Timing> {
        onProgress('Cold start');

        return time('Cold start', async () => {
            await this.open(db).orders.countAsync();
        });
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
