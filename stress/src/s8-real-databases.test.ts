import { afterAll, beforeAll, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { contractProductSchema } from '@routier/test-utils';
import {
    ChurnPlan,
    Churned,
    Oracle,
    Product,
    Rng,
    churnScale,
    churnShape,
    churnShapeCase,
    compareToOracle,
    containerStressDescribe,
    describeComparison,
    productFactory,
    productShape,
    runChurnWorkload,
    runVolumeWorkload,
    stressIt,
    volumePlanFor,
    volumeScale,
} from './harness';
import { PostgresHarness } from './harness/postgres';
import { MysqlHarness } from './harness/mysql';

/**
 * S8 — the loads from S1 and S3 against a real PostgreSQL server.
 *
 * Every other scenario runs against a plugin that is in this process or on this disk. That
 * makes them fast and deterministic, and it also means none of them has ever seen the things a
 * real server does: a transaction that aborts as a unit, a connection pool that can be
 * exhausted, DDL that must exist before the first insert, and type coercion performed by
 * something that is not JavaScript. `e2e/src/postgresContainer.test.ts` covers single
 * operations against a server; this covers the loads.
 *
 * Two loads, one concurrency scenario, and two reductions. The loads and the concurrency
 * scenario are what the spec asked for; the reductions were added once the loads failed, so that
 * each defect has a case naming it rather than one load tripping on several at once:
 *
 *  - **The volume load at 10k.** Hunts the flattened persist loop under real I/O, and
 *    savepoint handling: the plugin creates tables lazily by attempting the write and issuing
 *    DDL if it fails, which inside a transaction PostgreSQL aborts as a unit. That was defect
 *    #4, and it is fixed — this keeps it fixed under a load rather than a single insert.
 *  - **The churn load at 2k cycles.** The nested-object and array columns are the point. The
 *    SQL nested-column work (defect #15) was verified against SQLite, which stores JSON as
 *    text; PostgreSQL does not, and until this scenario nothing had driven a nested shape
 *    through a real server at all.
 *  - **Five plugin instances on one database.** The Postgres analogue of S5. S5 found that the
 *    file-system plugin loses data this way (defect #18) because each save rewrites the whole
 *    file; a server has no such excuse, and concurrent transactions from independent pools are
 *    the case its transaction handling exists for.
 *  - **Two reductions**, each the smallest shape that exhibits one defect: a heterogeneous update
 *    batch (#22) and a nested descendant colliding with a top-level property (#20). They are
 *    loads only in the sense that they live here — S8 is the only place a real server runs.
 *
 * Gated on `STRESS=1 E2E_CONTAINERS=1` — it needs a Docker daemon and a multi-second server
 * start, so it stays out of the default stress run.
 *
 * **What it found.** The volume load passes. Everything else in this file is pinned, and all
 * three defects are invisible to every in-process backend:
 *
 *  - **#19** an `s.array()` property cannot be written to PostgreSQL at all. The array is bound
 *    as a parameter to a json column and `pg` encodes a JS array as a Postgres array literal,
 *    which json rejects. The insert fails; no cycle of the churn load ever runs.
 *  - **#20** a nested object still emits a top-level column per descendant on the Postgres
 *    path — the shape defect #15 recorded as fixed. Harmless-looking until a descendant name
 *    collides with a real property, at which point the INSERT names one column twice.
 *  - **#21** the first concurrent write to a new collection loses four writes out of five, to a
 *    race between five instances each issuing the same CREATE TABLE.
 *  - **#22** one save cannot update two entities whose changed columns differ. The builder emits
 *    one UPDATE per changed-column group, `;`-joined into a single parameterised query, and
 *    PostgreSQL allows only one command per prepared statement. This needs no nested types and
 *    no concurrency, only an ordinary heterogeneous update batch.
 *
 * **The churn load's budget is unverified.** #19 rejects its first insert and #22 would reject
 * its first save, so 2,000 cycles against a real server has never actually run. The entity count
 * was reduced to 200 on the reasoning that every cycle re-reads the collection, but the wall
 * clock behind that is a projection, not a measurement. Whoever fixes #19 and #22 should time
 * this scenario before trusting the 5-minute budget.
 *
 * **Deviations from the spec, and why.** The spec also asks for these loads "against sqlite on
 * disk". The volume half is already there: `sqliteBackend` in backends.ts is a real file, and
 * S1 runs the same load through it at 20k. The churn half cannot be — the churn shape holds a
 * boolean, a date, an array and a nested object, and SQLite has a column type for none of them
 * and declines rich types in its own contract run. Running it there would test the fallback
 * path, not SQLite. The Postgres churn entity count is also reduced from S3's 1,000 to 200:
 * every cycle re-reads the whole collection, so at 2,000 cycles the entity count multiplies
 * round trips to a real server, and 1,000 does not fit the per-file budget.
 */

const postgres = new PostgresHarness();
const mysql = new MysqlHarness();

/** Every store opened by a scenario in this file, destroyed after each one. */
const stores: DataStore[] = [];

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

beforeAll(async () => {
    // `containerStressDescribe` skips the scenarios when the gates are off, but a root-level
    // `beforeAll` still runs — so starting a container here unconditionally would pay for
    // Docker on every default `npx jest`.
    if (process.env.STRESS === '1' && process.env.E2E_CONTAINERS === '1') {
        // Sequential, not concurrent: two servers booting at once on a laptop or a CI runner
        // contend for the same cores and both time out rather than one being slow.
        await postgres.start();
        await mysql.start();
    }
});

afterAll(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }

    if (postgres.started) {
        await postgres.stop();
    }

    if (mysql.started) {
        await mysql.stop();
    }
});

class ProductStore extends DataStore {
    products = this.collection(contractProductSchema).proxy().create();
}

class ChurnStore extends DataStore {
    entities: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).proxy().create();
    }
}

/**
 * The multi-instance shape.
 *
 * A plain string key rather than `identity()`, because the invariant is that five instances
 * writing disjoint key ranges end up with the union of their writes — and that needs each
 * instance to choose its own keys rather than have the server assign them.
 */
const multiInstanceSchema = s.define('stress_pg_multi', {
    id: s.string().key(),
    owner: s.number(),
    text: s.string(),
    count: s.number(),
}).compile();

class MultiInstanceStore extends DataStore {
    rows = this.collection(multiInstanceSchema).proxy().create();
}

type Row = { id: string; owner: number; text: string; count: number };

const INSTANCES = 5;
const KEYS_PER_INSTANCE = 40;
const ROUNDS = 10;

/** Postgres budget for the volume load. A tenth of the memory budget, per the spec. */
const VOLUME_BUDGET = 10_000;

const churnPlan: ChurnPlan = {
    entities: 200,
    cycles: 2_000,
    subset: 50,
    reconcileEvery: 500,
    sampleEvery: 250,
    previewEvery: 25,
    // The interesting memory is in the server, not in this process, and 2k cycles gives the
    // growth regression too few samples to fit. A verdict here would have no evidence behind it.
    trackMemory: false,
};

containerStressDescribe('S8 real databases: PostgreSQL via testcontainers', () => {
    const volumePlan = volumePlanFor(VOLUME_BUDGET);

    stressIt(
        `postgres: the volume load at ${VOLUME_BUDGET.toLocaleString('en-US')} entities loses nothing to real I/O`,
        {
            seed: 20260809,
            scale: volumeScale('postgres', volumePlan),
        },
        async ({ rng, note }) => {
            const store = track(new ProductStore(postgres.createPlugin()));

            await runVolumeWorkload<Product>({
                store,
                collection: store.products as any,
                plan: volumePlan,
                rng,
                note,
                newEntity: productFactory(),
                ...productShape,
            });
        }
    );

    stressIt(
        `postgres: the churn load survives ${churnPlan.cycles.toLocaleString('en-US')} cycles over nested and array columns`,
        {
            seed: 20260810,
            scale: churnScale('postgres', churnPlan),
        },
        async ({ rng, note }) => {
            const store = track(new ChurnStore(postgres.createPlugin(), churnShapeCase().schema));

            await runChurnWorkload<Churned>({
                store,
                collection: store.entities,
                plan: churnPlan,
                rng,
                note,
                ...churnShape,
            });
        }
    );

    /**
     * Two entities, one save, different sets of changed columns.
     *
     * The reduction of defect #22 (fixed). The SQL builder groups updates by which columns
     * changed and emits one UPDATE per group; those used to be joined with `;` into a single
     * parameterised query, which PostgreSQL rejects outright because a prepared statement may
     * carry only one command. Each group is now its own operation in the transaction.
     * SQLite's driver accepts multi-statement input, which is why no in-process backend ever
     * saw this.
     *
     * Nothing exotic is required to trigger it: two rows whose dirty columns differ. That
     * happens in ordinary use whenever one entity's new value equals its old one, so the write
     * that fails is not the write that looks unusual.
     */
    const heteroSchema = s.define('stress_pg_hetero', {
        id: s.string().key(),
        a: s.string(),
        b: s.number(),
    }).compile();

    class HeteroStore extends DataStore {
        rows = this.collection(heteroSchema).proxy().create();
    }

    stressIt(
        'postgres: one save may update two entities whose changed columns differ',
        {
            seed: 20260813,
            scale: { backend: 'postgres', entities: 2 },
        },
        async ({ note }) => {
            const store = track(new HeteroStore(postgres.createPlugin()));

            await store.rows.addAsync(
                { id: 'x', a: 'a1', b: 1 } as any,
                { id: 'y', a: 'a2', b: 2 } as any,
            );
            await store.saveChangesAsync();

            const rows = (await store.rows.toArrayAsync()) as { id: string; a: string; b: number }[];
            const x = rows.find(r => r.id === 'x')!;
            const y = rows.find(r => r.id === 'y')!;

            // One row changes `a` alone; the other changes `a` and `b`. Two groups, two
            // statements, one query.
            x.a = 'x-new';
            y.a = 'y-new';
            y.b = 99;

            await store.saveChangesAsync();

            const after = (await store.rows.toArrayAsync()) as { id: string; a: string; b: number }[];

            note(`after the save: ${JSON.stringify(after.map(r => ({ id: r.id, a: r.a, b: r.b })))}`);

            expect(after.find(r => r.id === 'x')!.a).toBe('x-new');
            expect(after.find(r => r.id === 'y')!.a).toBe('y-new');
            expect(after.find(r => r.id === 'y')!.b).toBe(99);
        }
    );

    /**
     * A schema whose nested object has a descendant named like a top-level property.
     *
     * Not a load, and deliberately not part of the churn scenario above — it is the two-entity
     * reduction of defect #20 (fixed), kept here because S8 is the only place a real server
     * runs. The Postgres plugin used to emit a top-level column per nested descendant, so this
     * shape asked for `"value"` twice in one INSERT; columns now come from sqlColumnProperties,
     * one JSON column per root property.
     */
    const collisionSchema = s.define('stress_pg_collision', {
        id: s.string().key(),
        value: s.string(),
        nested: s.object({ value: s.string() }),
    }).compile();

    class CollisionStore extends DataStore {
        rows = this.collection(collisionSchema).proxy().create();
    }

    stressIt(
        'postgres: a nested descendant may share a name with a top-level property',
        {
            seed: 20260812,
            scale: { backend: 'postgres', entities: 1 },
        },
        async ({ note }) => {
            const store = track(new CollisionStore(postgres.createPlugin()));

            await store.rows.addAsync({ id: 'a', value: 'TOP', nested: { value: 'INNER' } } as any);
            await store.saveChangesAsync();

            const [row] = (await store.rows.toArrayAsync()) as { id: string; value: string; nested: { value: string } }[];

            note(`read back value=${row?.value} nested.value=${row?.nested?.value}`);

            // The two must stay distinct. A single column serving both would silently make one
            // of them win, which is worse than the rejection this currently produces.
            expect(row.value).toBe('TOP');
            expect(row.nested.value).toBe('INNER');
        }
    );

    stressIt(
        `postgres: ${INSTANCES} plugin instances on one database converge on the union of their writes`,
        {
            seed: 20260811,
            scale: {
                backend: 'postgres',
                instances: INSTANCES,
                keysPerInstance: KEYS_PER_INSTANCE,
                rounds: ROUNDS,
                totalEntities: INSTANCES * KEYS_PER_INSTANCE,
            },
        },
        async ({ note }) => {
            // Five independent plugins, each with its own connection pool, over one database.
            const instances = Array.from({ length: INSTANCES }, () =>
                track(new MultiInstanceStore(postgres.createPlugin()))
            );

            const keyFor = (owner: number, index: number) => `i${String(owner).padStart(2, '0')}-${index}`;
            const mine = (owner: number) => `i${String(owner).padStart(2, '0')}-`;

            for (let round = 0; round < ROUNDS; round++) {
                // No awaiting between instances: the transactions overlap on the server, which
                // is the entire point of running this against one.
                await Promise.all(instances.map(async (store, owner) => {
                    // A per-instance, per-round seed, so an interleaving replays from the
                    // scenario's seed rather than from whichever pool answered first.
                    const rng = new Rng(20260811 + owner * 31 + round);

                    if (round === 0) {
                        await store.rows.addAsync(
                            ...Array.from({ length: KEYS_PER_INSTANCE }, (_, k) => ({
                                id: keyFor(owner, k),
                                owner,
                                text: `seed-${owner}-${k}`,
                                count: 0,
                            })) as any[]
                        );
                    } else {
                        const owned = ((await store.rows.toArrayAsync()) as Row[])
                            .filter(row => row.id.startsWith(mine(owner)));

                        for (const row of rng.sample(owned, Math.max(1, Math.floor(owned.length / 2)))) {
                            row.text = `i${owner}-r${round}`;
                            row.count = round;
                        }
                    }

                    await store.saveChangesAsync();
                }));
            }

            // Each instance owns a disjoint key range, so the final value of any row is
            // whatever its owner wrote last, regardless of which transaction committed first.
            const union = new Oracle<Row>(row => row.id);

            for (let owner = 0; owner < instances.length; owner++) {
                ((await instances[owner].rows.toArrayAsync()) as Row[])
                    .filter(row => row.id.startsWith(mine(owner)))
                    .forEach(row => union.set({ id: row.id, owner: row.owner, text: row.text, count: row.count }));
            }

            const expectedTotal = INSTANCES * KEYS_PER_INSTANCE;

            note(`union oracle holds ${union.size} of an expected ${expectedTotal} rows`);

            expect(union.size).toBe(expectedTotal);

            // Every instance sees the whole database, not only its own writes.
            for (let owner = 0; owner < instances.length; owner++) {
                const seen = (await instances[owner].rows.toArrayAsync()) as Row[];
                const comparison = compareToOracle(union, seen, row => row.id, {
                    fields: ['owner', 'text', 'count'],
                });

                if (comparison.matches === false) {
                    note(`instance ${owner}: ${describeComparison(comparison)}`);
                }

                expect(comparison.matches ? 'oracle matches' : `instance ${owner}: ${describeComparison(comparison)}`)
                    .toBe('oracle matches');
            }
        }
    );
});

/**
 * The same loads against MySQL.
 *
 * A separate block rather than a parameterisation over both servers, because the point is
 * not that the loads pass twice — it is that MySQL fails differently, and a green PostgreSQL
 * run says nothing about it. DDL implicitly commits here, so a table created inside a save
 * ends that save's transaction; there is no RETURNING, so every written row is read back by
 * a second statement whose correctness rests on an assumption about what the server just
 * did; and a stale conditional update is `affectedRows === 0` rather than an empty result.
 *
 * The multi-instance scenario is the one that earns its runtime: five plugins racing through
 * table creation on one database is exactly where implicit-commit DDL corrupts a *concurrent*
 * writer's rollback rather than only its own.
 */
containerStressDescribe('S8 real databases: MySQL via testcontainers', () => {
    const volumePlan = volumePlanFor(VOLUME_BUDGET);

    stressIt(
        `mysql: the volume load at ${VOLUME_BUDGET.toLocaleString('en-US')} entities loses nothing to real I/O`,
        {
            seed: 20260809,
            scale: volumeScale('mysql', volumePlan),
        },
        async ({ rng, note }) => {
            const store = track(new ProductStore(mysql.createPlugin()));

            await runVolumeWorkload<Product>({
                store,
                collection: store.products as any,
                plan: volumePlan,
                rng,
                note,
                newEntity: productFactory(),
                ...productShape,
            });
        }
    );

    stressIt(
        `mysql: the churn load survives ${churnPlan.cycles.toLocaleString('en-US')} cycles over nested and array columns`,
        {
            seed: 20260810,
            scale: churnScale('mysql', churnPlan),
        },
        async ({ rng, note }) => {
            const store = track(new ChurnStore(mysql.createPlugin(), churnShapeCase().schema));

            await runChurnWorkload<Churned>({
                store,
                collection: store.entities,
                plan: churnPlan,
                rng,
                note,
                ...churnShape,
            });
        }
    );

    stressIt(
        `mysql: ${INSTANCES} plugin instances on one database converge on the union of their writes`,
        {
            seed: 20260812,
            scale: {
                backend: 'mysql',
                instances: INSTANCES,
                keysPerInstance: KEYS_PER_INSTANCE,
                rounds: ROUNDS,
                totalEntities: INSTANCES * KEYS_PER_INSTANCE,
            },
        },
        async ({ note }) => {
            const instances = Array.from({ length: INSTANCES }, () =>
                track(new MultiInstanceStore(mysql.createPlugin()))
            );

            // A distinct key prefix from the PostgreSQL scenario: both write to a collection
            // of the same name, and reusing the prefix would make a leak between the two
            // blocks look like convergence.
            const keyFor = (owner: number, index: number) => `m${String(owner).padStart(2, '0')}-${index}`;
            const mine = (owner: number) => `m${String(owner).padStart(2, '0')}-`;

            for (let round = 0; round < ROUNDS; round++) {
                // No awaiting between instances: the transactions overlap on the server,
                // which is the entire point of running this against one.
                await Promise.all(instances.map(async (store, owner) => {
                    const rng = new Rng(20260812 + owner * 31 + round);

                    if (round === 0) {
                        await store.rows.addAsync(
                            ...Array.from({ length: KEYS_PER_INSTANCE }, (_, k) => ({
                                id: keyFor(owner, k),
                                owner,
                                text: `seed-${owner}-${k}`,
                                count: 0,
                            })) as any[]
                        );
                    } else {
                        const owned = ((await store.rows.toArrayAsync()) as Row[])
                            .filter(row => row.id.startsWith(mine(owner)));

                        for (const row of rng.sample(owned, Math.max(1, Math.floor(owned.length / 2)))) {
                            row.text = `m${owner}-r${round}`;
                            row.count = round;
                        }
                    }

                    await store.saveChangesAsync();
                }));
            }

            const union = new Oracle<Row>(row => row.id);

            for (let owner = 0; owner < instances.length; owner++) {
                ((await instances[owner].rows.toArrayAsync()) as Row[])
                    .filter(row => row.id.startsWith(mine(owner)))
                    .forEach(row => union.set({ id: row.id, owner: row.owner, text: row.text, count: row.count }));
            }

            const expectedTotal = INSTANCES * KEYS_PER_INSTANCE;

            note(`union oracle holds ${union.size} of an expected ${expectedTotal} rows`);

            expect(union.size).toBe(expectedTotal);

            // Every instance sees the whole database, not only its own writes.
            for (let owner = 0; owner < instances.length; owner++) {
                const seen = (await instances[owner].rows.toArrayAsync()) as Row[];
                const comparison = compareToOracle(union, seen, row => row.id, {
                    fields: ['owner', 'text', 'count'],
                });

                if (comparison.matches === false) {
                    note(`instance ${owner}: ${describeComparison(comparison)}`);
                }

                expect(comparison.matches ? 'oracle matches' : `instance ${owner}: ${describeComparison(comparison)}`)
                    .toBe('oracle matches');
            }
        }
    );
});
