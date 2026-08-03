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
 * CURRENTLY FAILING — and the failure is the point of having this suite.
 *
 * PostgresDbPlugin creates tables lazily by attempting the write first and issuing the
 * CREATE TABLE only if that write fails (PostgresDbPlugin.ts: run op.sql at ~170, CREATE
 * TABLE at ~173, retry at ~188). Outside a transaction that works. Inside the BEGIN opened
 * at ~136 it cannot: PostgreSQL aborts the whole transaction on the first error, so the
 * CREATE TABLE and the retry both come back 25P02 "current transaction is aborted", and
 * that cascade is what surfaces to the caller instead of the original
 * "relation does not exist".
 *
 * Consequences: every first write to a collection fails against a fresh database, and the
 * reported error points away from the cause. A fix needs a SAVEPOINT before the attempted
 * write and a ROLLBACK TO SAVEPOINT before the DDL, or the table check hoisted out of the
 * transaction entirely.
 *
 * Left failing rather than skipped: this is a real defect against a real server, and the
 * suite exists to keep saying so. No in-process plugin test can reproduce it, because the
 * SQLite path takes the non-transactional branch.
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
});
