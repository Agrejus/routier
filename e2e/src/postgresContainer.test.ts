import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { ConcurrencyDbPlugin, OptimisticConcurrencyError } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { executedQueriesOf } from '@routier/core/plugins';

/**
 * Routier against a real PostgreSQL server, started in a container.
 *
 * A SQL engine disagrees with an in-process plugin in ways only a real server shows:
 * collation-dependent string ordering, integer versus boolean storage, connection
 * lifecycle, and DDL that has to exist before the first insert. None of that is observable
 * against a JavaScript object graph.
 *
 * Opt-in: containers need a Docker daemon and a multi-second startup, so this suite is
 * gated behind E2E_CONTAINERS. CI runs it nightly and on release, not on every PR.
 *
 * The suite's original reason for existing was defect #4 — lazy table creation could not work
 * inside the plugin's own transaction, so every first write to a fresh database failed. **That
 * is fixed**, and the cases below pass.
 *
 * What replaces it: four defects that S8 found by running real *loads* against a server
 * (`stress/src/s8-real-databases.test.ts`). Each is reduced to its smallest form here —
 * originally pinned with `it.failing`, now regular guards since all four are fixed. All four
 * were invisible to every in-process backend — see `specs/known-defects.md` entries 19
 * through 22 for the causes and fixes.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';

// `describe.skip` rather than an early return so the suite is listed as skipped and its
// existence stays visible, instead of silently reporting an empty file.
const suite = shouldRun ? describe : describe.skip;

const schema = s.define('e2e_pg_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(schema).proxy().create();
}

suite('PostgreSQL via testcontainers', () => {
    let container: StartedPostgreSqlContainer;
    let store: ProductStore;

    /**
     * Every store opened INSIDE a test, disposed after it.
     *
     * Each `connect()` builds a new plugin and therefore a new `pg` Pool, and a Pool holds
     * its idle clients — sockets — open until it is ended. Tests below call `connect()`
     * freely to prove a read came off the server rather than out of a client cache, and none
     * of those stores used to be destroyed. The pools kept the event loop alive after the
     * last assertion, which is the five-minute hang the audit recorded and the reason this
     * project could not drop `--forceExit`.
     */
    const opened: DataStore[] = [];

    const pluginConfig = () => ({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
    });

    const connect = () => {
        const created = new ProductStore(new PostgresDbPlugin(pluginConfig()));
        opened.push(created);
        return created;
    };

    afterEach(async () => {
        for (const created of opened.splice(0)) {
            await created.destroyAsync().catch(() => undefined);
        }
    });

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
        // NOT tracked in `opened`: this one is shared by every test and lives until
        // afterAll. `destroy()` here only ends the pool — it does not drop tables — so
        // disposing the per-test stores leaves the seeded rows on the server.
        store = new ProductStore(new PostgresDbPlugin(pluginConfig()));
        await store.products.addAsync(
            { name: 'apple', category: 'fruit', price: 10 } as any,
            { name: 'Banana', category: 'fruit', price: 30 } as any,
            { name: 'cherry', category: 'dry', price: 20 } as any,
        );
        await store.saveChangesAsync();
    });

    afterAll(async () => {
        await store?.destroyAsync().catch(() => undefined);
        await container?.stop();
    });

    it('persists rows to the server', async () => {
        expect(await store.products.countAsync()).toBe(3);
    });

    it('reads rows back through a second connection', async () => {
        // A separate plugin instance and connection pool: proves the rows are on the server
        // rather than cached in the first client.
        expect(await connect().products.countAsync()).toBe(3);
    });

    it('filters with a comparison', async () => {
        const found = await store.products.where(p => p.price > 15).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Banana', 'cherry']);
    });

    it('explains a query: reports the SQL it executed', async () => {
        const { data, explanation } = await store.products
            .where(p => p.price > 15)
            .explain()
            .toArrayAsync();

        expect(data.map(p => p.name).sort()).toEqual(['Banana', 'cherry']);

        const reported = executedQueriesOf(explanation);
        expect(reported.length).toBeGreaterThan(0);
        expect(reported[0].text).toContain('SELECT');
        expect(reported[0].parameters).toEqual([15]);
    });

    it('filters with equality on a string', async () => {
        expect(await store.products.where(p => p.category === 'fruit').countAsync()).toBe(2);
    });

    it('sorts numerically', async () => {
        const found = await store.products.sort(p => p.price).toArrayAsync();

        expect(found.map(p => p.price)).toEqual([10, 20, 30]);
    });

    it('aggregates', async () => {
        expect(await store.products.sumAsync(p => p.price)).toBe(60);
        expect(await store.products.minAsync(p => p.price)).toBe(10);
        expect(await store.products.maxAsync(p => p.price)).toBe(30);
    });

    it('orders mixed-case strings the same way JavaScript does', async () => {
        const found = await store.products.sort(p => p.name).toArrayAsync();

        // Postgres collations frequently order case differently from JS string comparison
        // ('Banana' before 'apple' under C collation, after it under en_US). Whichever the
        // plugin produces, it must match what a caller sorting in JS would get, or the same
        // query returns different orders on different backends.
        expect(found.map(p => p.name)).toEqual(['apple', 'Banana', 'cherry'].sort());
    });

    it('persists an update', async () => {
        const found = await store.products.firstAsync(p => p.name === 'apple');
        found.price = 99;
        await store.saveChangesAsync();

        expect((await connect().products.firstAsync(p => p.name === 'apple')).price).toBe(99);
    });

    it('persists a removal', async () => {
        const target = await store.products.firstAsync(p => p.name === 'cherry');
        await store.products.removeAsync(target);
        await store.saveChangesAsync();

        expect(await connect().products.countAsync()).toBe(2);
    });

    /**
     * Reductions of the four defects S8 found, all fixed — kept as regression guards against
     * a real server.
     *
     * These use their own schemas and tables rather than `products`, so a failure names one
     * defect and the passing cases above stay independent of them.
     */
    describe('defects found by S8, guarded', () => {
        const arraySchema = s.define('e2e_pg_defect_array', {
            _id: s.string().key().identity(),
            values: s.array(s.string()),
        }).compile();

        const collisionSchema = s.define('e2e_pg_defect_collision', {
            _id: s.string().key().identity(),
            value: s.string(),
            nested: s.object({ value: s.string() }),
        }).compile();

        const heteroSchema = s.define('e2e_pg_defect_hetero', {
            id: s.string().key(),
            a: s.string(),
            b: s.number(),
        }).compile();

        class ArrayStore extends DataStore {
            rows = this.collection(arraySchema).proxy().create();
        }

        class CollisionStore extends DataStore {
            rows = this.collection(collisionSchema).proxy().create();
        }

        class HeteroStore extends DataStore {
            rows = this.collection(heteroSchema).proxy().create();
        }

        const open = <T extends DataStore>(Ctor: new (plugin: PostgresDbPlugin) => T): T => {
            const created = new Ctor(new PostgresDbPlugin(pluginConfig()));
            opened.push(created);
            return created;
        };

        // Guards the fix for defect #19: `pg` encodes a JS array as a PostgreSQL array
        // literal, which a json column rejects. Insert params now go through
        // toColumnValueMap, which JSON-encodes structures before they are bound.
        it('writes an array property', async () => {
            const store = open(ArrayStore);

            await store.rows.addAsync({ values: ['x', 'y'] } as any);
            await store.saveChangesAsync();

            expect((await store.rows.toArrayAsync())[0].values).toEqual(['x', 'y']);
        });

        // Guards the fix for defect #20: a nested object used to emit a top-level column per
        // descendant, so this INSERT named "value" twice. Columns now come from
        // sqlColumnProperties — one JSON column per root property.
        it('keeps a nested descendant distinct from a top-level property of the same name', async () => {
            const store = open(CollisionStore);

            await store.rows.addAsync({ value: 'TOP', nested: { value: 'INNER' } } as any);
            await store.saveChangesAsync();

            const [row] = await store.rows.toArrayAsync();

            expect(row.value).toBe('TOP');
            expect(row.nested.value).toBe('INNER');
        });

        // Guards the fix for defect #22: two changed-column groups used to become two
        // `;`-joined statements in one prepared statement, which PostgreSQL refuses. Each
        // group is now its own operation in the transaction.
        it('updates two entities whose changed columns differ in one save', async () => {
            const store = open(HeteroStore);

            await store.rows.addAsync(
                { id: 'x', a: 'a1', b: 1 } as any,
                { id: 'y', a: 'a2', b: 2 } as any,
            );
            await store.saveChangesAsync();

            const rows = await store.rows.toArrayAsync();
            const x = rows.find(r => r.id === 'x')!;
            const y = rows.find(r => r.id === 'y')!;

            x.a = 'x-new';
            y.a = 'y-new';
            y.b = 99;

            await store.saveChangesAsync();

            const after = await store.rows.toArrayAsync();

            expect(after.find(r => r.id === 'x')!.a).toBe('x-new');
            expect(after.find(r => r.id === 'y')!.b).toBe(99);
        });

        // Defect #21 is not pinned here. It needs five concurrent plugin instances racing to
        // create one table, which is a load rather than an operation — it lives in S8, where
        // the harness prints the seed and scale that make the race reproducible.
    });

    describe('optimistic concurrency', () => {
        const occSchema = s.define('e2e_pg_occ', {
            id: s.string().key().identity(),
            balance: s.number(),
        }).compile();

        class OccStore extends DataStore {
            accounts = this.collection(occSchema).proxy().create();
        }

        const open = (): OccStore => {
            const created = new OccStore(new ConcurrencyDbPlugin(new PostgresDbPlugin(pluginConfig())));
            opened.push(created);
            return created;
        };

        it('rejects a stale write against a real server and allows a retry', async () => {
            const writerA = open();
            const writerB = open();

            const [seeded] = await writerA.accounts.addAsync({ balance: 1000 } as any);
            await writerA.saveChangesAsync();
            const id = (seeded as any).id;

            const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
            const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
            expect(a.__version).toBeUndefined();
            expect(b.__version).toBeUndefined();

            a.balance = 900;
            await writerA.saveChangesAsync();

            b.balance = 1100;
            const error = await writerB.saveChangesAsync().then(() => null, e => e);

            expect(OptimisticConcurrencyError.is(error)).toBe(true);
            expect(error.conflicts).toEqual([id]);

            // The conflicted save rolled back as a unit; the winner's write survived
            const fresh: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
            expect(fresh.balance).toBe(900);

            fresh.balance = fresh.balance - 250;
            await writerB.saveChangesAsync();

            const final: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
            expect(final.balance).toBe(650);
        });

        it('leaves an unrelated row untouched when another row conflicts', async () => {
            // The conflicted save must roll back as a unit, including writes to rows that
            // had no conflict of their own.
            const writerA = open();
            const writerB = open();

            const [one, two] = await writerA.accounts.addAsync(
                { balance: 10 } as any,
                { balance: 20 } as any,
            );
            await writerA.saveChangesAsync();

            const contested = (one as any).id;
            const bystander = (two as any).id;

            // B reads BEFORE A writes — that is what makes B's copy stale. Reading after
            // A's save would give B a current row and no conflict to detect.
            const bContested: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id: contested });
            const bBystander: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id: bystander });

            const aRow: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id: contested });
            aRow.balance = 11;
            await writerA.saveChangesAsync();

            bContested.balance = 999;
            bBystander.balance = 888;

            const error = await writerB.saveChangesAsync().then(() => null, e => e);
            expect(OptimisticConcurrencyError.is(error)).toBe(true);

            const after: any = await open().accounts.firstAsync(([x, p]) => x.id === p.id, { id: bystander });
            expect(after.balance).toBe(20);
        });
    });

    /**
     * What the plugin does when the server says no.
     *
     * The audit's gap: every existing case was a happy path against a healthy server, so
     * nothing proved that a failure mid-transaction rolls back, that a constraint violation
     * surfaces as a rejected save rather than a hang, or that an exhausted pool queues
     * instead of deadlocking. Each of these has a failure mode — hanging — that a suite
     * without them reports as a pass.
     */
    describe('failure paths', () => {
        const failSchema = s.define('e2e_pg_failures', {
            id: s.string().key(),
            value: s.string(),
        }).compile();

        class FailStore extends DataStore {
            rows = this.collection(failSchema).proxy().create();
        }

        const open = (poolMax?: number): FailStore => {
            const created = new FailStore(new PostgresDbPlugin({
                ...pluginConfig(),
                ...(poolMax == null ? {} : { pool: { max: poolMax } }),
            }));
            opened.push(created);
            return created;
        };

        it('rejects a duplicate primary key instead of hanging', async () => {
            const store = open();
            await store.rows.addAsync({ id: 'dup', value: 'first' } as any);
            await store.saveChangesAsync();

            const second = open();
            await second.rows.addAsync({ id: 'dup', value: 'second' } as any);

            // A rejection, not a timeout. The plugin's error path has to release the client
            // and call back — an unreleased client would drain the pool and hang the next
            // test instead of this one.
            const outcome = await second.saveChangesAsync().then(() => 'resolved', e => e);

            expect(outcome).not.toBe('resolved');
        });

        it('rolls the whole transaction back when one row in the batch fails', async () => {
            const store = open();
            await store.rows.addAsync({ id: 'existing', value: 'original' } as any);
            await store.saveChangesAsync();

            // One good row and one that collides, in a single save.
            const writer = open();
            await writer.rows.addAsync(
                { id: 'newcomer', value: 'should not survive' } as any,
                { id: 'existing', value: 'collides' } as any,
            );

            await writer.saveChangesAsync().catch(() => undefined);

            // Asserted per id rather than by count: this table is shared with the other
            // cases in this block, so a total is not this test's to claim.
            const reader = open();
            const present = (await reader.rows.toArrayAsync()).map(r => r.id);

            expect(present).not.toContain('newcomer');
            expect((await reader.rows.firstAsync(r => r.id === 'existing')).value).toBe('original');
        });

        it('returns its client to the pool after a failed save', async () => {
            // A pool of one: if the failed save below does not release its client, the
            // query afterwards has nothing to run on and waits forever.
            const store = open(1);
            await store.rows.addAsync({ id: 'usable', value: 'seed' } as any);
            await store.saveChangesAsync();

            const writer = open(1);
            await writer.rows.addAsync({ id: 'usable', value: 'collides' } as any);
            await writer.saveChangesAsync().catch(() => undefined);

            // Not another save: a failed save leaves its changes pending, so retrying
            // would collide a second time and prove nothing about the pool.
            expect(await writer.rows.countAsync()).toBeGreaterThan(0);
        });

        it('serializes concurrent saves through a pool of one', async () => {
            // max: 1 means the second save waits for the first client to be released.
            // Anything that forgets to release turns this into a deadlock.
            //
            // Two STORES, not two saves on one store: concurrent saves on a single store
            // flush the same pending set twice, which is a change-tracker question rather
            // than a pool one.
            const a = open(1);
            const b = open(1);

            await Promise.all([
                a.rows.addAsync({ id: 'pool-a', value: 'a' } as any).then(() => a.saveChangesAsync()),
                b.rows.addAsync({ id: 'pool-b', value: 'b' } as any).then(() => b.saveChangesAsync()),
            ]);

            const ids = (await open().rows.toArrayAsync()).map(r => r.id).filter(id => id.startsWith('pool-'));
            expect(ids.sort()).toEqual(['pool-a', 'pool-b']);
        });

        it('answers queries through a pool of one', async () => {
            const store = open(1);

            const counts = await Promise.all(
                Array.from({ length: 5 }, () => store.rows.countAsync())
            );

            expect(counts.every(c => typeof c === 'number')).toBe(true);
        });
    });
});

/**
 * The server going away mid-flight, in its own container.
 *
 * Separate because the test stops the server, and every case above shares one container.
 * Without the pool `error` handler added for defect #4 this crashed the process rather than
 * rejecting the save.
 */
const disconnectSuite = shouldRun ? describe : describe.skip;

disconnectSuite('PostgreSQL disconnect during use', () => {
    const schema = s.define('e2e_pg_disconnect', {
        id: s.string().key(),
        value: s.string(),
    }).compile();

    class Store extends DataStore {
        rows = this.collection(schema).proxy().create();
    }

    let container: StartedPostgreSqlContainer;
    let store: Store;

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
        store = new Store(new PostgresDbPlugin({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        }));

        await store.rows.addAsync({ id: 'before', value: 'v' } as any);
        await store.saveChangesAsync();
    });

    afterAll(async () => {
        await store?.destroyAsync().catch(() => undefined);
        await container?.stop().catch(() => undefined);
    });

    it('rejects the save and keeps the process alive when the server stops', async () => {
        await container.stop();

        await store.rows.addAsync({ id: 'after', value: 'v' } as any);

        const outcome = await store.saveChangesAsync().then(() => 'resolved', () => 'rejected');

        // Rejected, not resolved, and above all not an uncaught 'error' event on an idle
        // client taking the process down with it.
        expect(outcome).toBe('rejected');
    });
});

/**
 * An identity key with a date property, which could not be saved at all before defect #70.
 *
 * The failure was `Cannot find internal addition`: the correlation hash could not match the
 * echoed row, because a `TIMESTAMP` column returned the value shifted by the client's UTC
 * offset. The column is `TIMESTAMPTZ` now and the instant survives.
 */
const dateSuite = shouldRun ? describe : describe.skip;

dateSuite('identity key with a date property', () => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
    }, 180_000);

    afterAll(async () => {
        await container?.stop().catch(() => undefined);
    });

    const dated = s.define('e2e_pg_identity_date', {
        id: s.string().key().identity(),
        name: s.string(),
        createdAt: s.date(),
    }).compile();

    class DatedStore extends DataStore {
        rows = this.collection(dated).proxy().create();
    }

    const openDated = () => new DatedStore(new PostgresDbPlugin({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
    }));

    it('saves a row whose key is generated and which carries a date', async () => {
        const store = openDated();

        await store.rows.addAsync({ name: 'x', createdAt: new Date() } as never);

        await expect(store.saveChangesAsync()).resolves.toBeDefined();

        await store.destroyAsync().catch(() => undefined);
    });

    /**
     * The defect underneath the one above, and the more dangerous half: with an explicit key
     * the hash still matched, so a shifted date was accepted without any error at all.
     */
    it('reads back the instant that was written, to the millisecond', async () => {
        const store = openDated();
        const sent = new Date('2020-01-02T03:04:05.123Z');

        await store.rows.addAsync({ name: 'precise', createdAt: sent } as never);
        await store.saveChangesAsync();

        const [row] = await store.rows.where(([r, p]) => r.name === p.n, { n: 'precise' }).toArrayAsync();

        expect(new Date(row.createdAt as never).toISOString()).toBe(sent.toISOString());

        await store.destroyAsync().catch(() => undefined);
    });
});
