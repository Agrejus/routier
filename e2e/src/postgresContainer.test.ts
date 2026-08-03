import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';

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
    products = this.collection(schema).create();
}

suite('PostgreSQL via testcontainers', () => {
    let container: StartedPostgreSqlContainer;
    let store: ProductStore;

    const connect = () => new ProductStore(new PostgresDbPlugin({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
    }));

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
        store = connect();
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
            rows = this.collection(arraySchema).create();
        }

        class CollisionStore extends DataStore {
            rows = this.collection(collisionSchema).create();
        }

        class HeteroStore extends DataStore {
            rows = this.collection(heteroSchema).create();
        }

        const open = <T extends DataStore>(Ctor: new (plugin: PostgresDbPlugin) => T): T =>
            new Ctor(new PostgresDbPlugin({
                host: container.getHost(),
                port: container.getPort(),
                database: container.getDatabase(),
                user: container.getUsername(),
                password: container.getPassword(),
            }));

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
});
