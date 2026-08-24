import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PGlite } from '@electric-sql/pglite';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { pgliteDbPlugin, PGliteLike } from '@routier/pglite-plugin';

/**
 * The same values, written and read back through both PostgreSQL engines, compared to each other.
 *
 * `dialectConformance.test.ts` already runs the behavioural matrix against both, and it is the
 * stronger test of the two. This one asks the narrower question that matrix cannot: whether the
 * two DRIVERS decode a row the same way. They are different client libraries over one wire
 * protocol, and type decoding is exactly where they are free to differ — `node-postgres` returns
 * `COUNT(*)` as a string and PGlite as a number, which is one divergence already known and
 * absorbed by `PostgresSqlTranslator`. This is where the next one shows up.
 *
 * Gated with the rest of the container suites: half of it needs a server.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

const schema = s.define('e2e_parity_rows', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
    at: s.date(),
    tags: s.array(s.string()),
    detail: s.object({ note: s.string(), size: s.number() }),
    missing: s.string().optional(),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const seed = {
    id: 'parity',
    name: "o'brien",
    price: 19.95,
    active: true,
    at: new Date('2024-03-04T05:06:07.000Z'),
    tags: ['a', 'b'],
    detail: { note: 'nested', size: 3 },
} as const;

suite('PGlite and node-postgres decode a row the same way', () => {
    let container: StartedPostgreSqlContainer;
    let database: PGlite;
    let server: Store;
    let wasm: Store;

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
        database = await PGlite.create('memory://parity');

        server = new Store(new PostgresDbPlugin({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        }));

        wasm = new Store(pgliteDbPlugin('memory://parity', {
            query: (sql, params) => database.query(sql, params),
            exec: (sql) => database.exec(sql),
            close: () => Promise.resolve(),
        } satisfies PGliteLike));

        for (const store of [server, wasm]) {
            await store.rows.addAsync({ ...seed, tags: [...seed.tags], detail: { ...seed.detail } });
            await store.saveChangesAsync();
        }
    }, 240_000);

    afterAll(async () => {
        await server?.destroyAsync().catch((): void => undefined);
        await wasm?.destroyAsync().catch((): void => undefined);
        await database?.close().catch((): void => undefined);
        await container?.stop();
    });

    const both = async <T>(read: (store: Store) => Promise<T>): Promise<[T, T]> =>
        [await read(server), await read(wasm)];

    it('returns the same entity', async () => {
        const [fromServer, fromWasm] = await both(store =>
            store.rows.where(w => w.id === 'parity').firstAsync());

        expect(fromWasm).toEqual(fromServer);
    });

    it('gives every property the same JavaScript type', async () => {
        const [fromServer, fromWasm] = await both(store =>
            store.rows.where(w => w.id === 'parity').firstAsync());

        const shape = (row: Record<string, unknown>) => Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
                key,
                value instanceof Date ? 'Date' : Array.isArray(value) ? 'Array' : typeof value,
            ])
        );

        expect(shape(fromWasm as never)).toEqual(shape(fromServer as never));
    });

    it('counts to the same number, not to a number and a string', async () => {
        const [fromServer, fromWasm] = await both(store => store.rows.countAsync());

        expect(typeof fromWasm).toBe('number');
        expect(fromWasm).toBe(fromServer);
    });

    it('reads an unset optional property back the same way', async () => {
        const [fromServer, fromWasm] = await both(store =>
            store.rows.where(w => w.id === 'parity').firstAsync());

        expect((fromWasm as { missing?: string }).missing)
            .toEqual((fromServer as { missing?: string }).missing);
    });
});
