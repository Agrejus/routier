import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { executedQueriesOf } from '@routier/core/plugins';

/**
 * Casing calls against a real MySQL server.
 *
 * `mysqlContainer.test.ts` cannot start a container in every environment — its log-wait strategy
 * fails where the Docker log stream closes early — so this reads connection details from the
 * environment instead. Skipped unless `ROUTIER_MYSQL_HOST` is set.
 *
 * The plugin renders through `toSql` with the mysql dialect, which quotes with backticks and had
 * never rendered LOWER() over a real server. This is the one that proves the engine agrees.
 */

const host = process.env.ROUTIER_MYSQL_HOST;
const suite = host == null ? describe.skip : describe;

const schema = s.define(`casing_${uuidv4().replace(/-/g, '')}`, {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

class CasingStore extends DataStore {
    products = this.collection(schema).proxy().create();
}

suite('casing calls against a real MySQL', () => {

    const opened: CasingStore[] = [];

    const config = () => ({
        host: host!,
        port: Number(process.env.ROUTIER_MYSQL_PORT ?? 3306),
        database: process.env.ROUTIER_MYSQL_DATABASE ?? 'routier',
        user: process.env.ROUTIER_MYSQL_USER ?? 'root',
        password: process.env.ROUTIER_MYSQL_PASSWORD ?? 'routier',
    });

    // Seeded once, not per case. `destroy` on a real server closes the pool without dropping the
    // database -- postgres-core refuses to drop what it did not create -- so re-seeding would
    // accumulate rows and turn a correct filter into a wrong count.
    let store: CasingStore;

    const seeded = async () => store;

    beforeAll(async () => {
        store = new CasingStore(new MysqlDbPlugin(config()));
        opened.push(store);
        await store.products.addAsync(
            { name: 'Alpha', category: 'tools', price: 10 } as never,
            { name: 'Bravo', category: 'tools', price: 30 } as never,
            { name: 'Charlie', category: 'toys', price: 20 } as never,
            { name: 'Delta', category: 'toys', price: 40 } as never,
        );
        await store.saveChangesAsync();
    });

    afterAll(async () => {
        await Promise.all(opened.splice(0).map(current => current.destroyAsync().catch(() => undefined)));
    });

    it('filters through a lower-case call, which becomes LOWER() in the statement', async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.name.toLowerCase() === 'bravo').toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    it('filters through an upper-case call', async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.category.toUpperCase() === 'TOYS').toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Charlie', 'Delta']);
    });

    /**
     * MySQL disagrees with JavaScript here, and not because of the call.
     *
     * The default collation is `utf8mb4_0900_ai_ci` — case- and accent-INSENSITIVE — so every string
     * comparison ignores case: `'Bravo' = 'bravo'` is true before any LOWER() is involved. So a
     * filter pushed down to MySQL can return rows the in-memory fallback would exclude, for plain
     * equality as much as for a casing call.
     *
     * Pinned rather than asserted-away: it is a real divergence, it predates casing calls, and a
     * schema that needs JavaScript's answer has to declare a `_bin` or `_as_cs` collation.
     */
    it('ignores case even against an unfolded literal, because of the database collation', async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.name.toLowerCase() === 'Bravo').toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    it('ignores case for plain equality too, which is the same divergence without a call', async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.name === 'bravo').toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    it('filters through a call on a relational comparator', async () => {
        const store = await seeded();
        const found = await store.products.where(p => p.name.toLowerCase() > 'b').toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Bravo', 'Charlie', 'Delta']);
    });

    it('filters through a call on both sides of a comparison', async () => {
        const store = await seeded();
        const found = await store.products
            .where(p => p.name.toLowerCase() === p.category.toLowerCase())
            .toArrayAsync();

        expect(found).toEqual([]);
    });

    it('reports the statement it executed, with LOWER in it and the value bound', async () => {
        const store = await seeded();
        const { data, explanation } = await store.products
            .where(p => p.name.toLowerCase() === 'bravo')
            .explain()
            .toArrayAsync();

        expect(data.map(p => p.name)).toEqual(['Bravo']);

        const reported = executedQueriesOf(explanation);

        expect(reported[0].text).toContain('LOWER');
        expect(reported[0].parameters).toEqual(['bravo']);
    });

    it('filters through modulo, which PostgreSQL needs MOD() and a numeric cast for', async () => {
        const found = await store.products.where(p => p.price % 20 === 0).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Charlie', 'Delta']);
    });

    it('filters through multiplication by a float', async () => {
        const found = await store.products.where(p => p.price * 1.5 > 45).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Delta']);
    });

    it('filters through division', async () => {
        const found = await store.products.where(p => p.price / 10 === 2).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Charlie']);
    });

    it('gives multiplication precedence over addition', async () => {
        const found = await store.products.where(p => p.price + 3 * 4 === 22).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Alpha']);
    });

    // The fractional remainder: SQLite's own `%` truncates to integer, PostgreSQL needs numeric,
    // MSSQL needs a decimal cast, and all four engines have to land on JavaScript's answer
    it('filters through a remainder of a fractional value', async () => {
        const found = await store.products.where(p => p.price / 4 % 2 === 0.5).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Alpha']);
    });

    it('filters through a bitwise and, which needs an integer cast on this engine', async () => {
        const found = await store.products.where(p => (p.price & 20) === 20).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Bravo', 'Charlie']);
    });

    it('filters through nullish coalescing', async () => {
        const found = await store.products.where(p => (p.category ?? 'none') === 'toys').toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Charlie', 'Delta']);
    });

    it('filters through a template literal', async () => {
        const found = await store.products.where(p => `${p.name}!` === 'Bravo!').toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    // Declared by no dialect yet, so it runs in memory — the rows must still be right
    it('filters through a regular expression, whoever ends up running it', async () => {
        const found = await store.products.where(p => /^[AB]/.test(p.name)).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Alpha', 'Bravo']);
    });
});
