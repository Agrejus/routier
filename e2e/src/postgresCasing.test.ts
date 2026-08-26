import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';

/**
 * Casing calls against a real PostgreSQL server.
 *
 * `postgresContainer.test.ts` cannot start a container in every environment — its log-wait strategy
 * fails where the Docker log stream closes early — so this reads connection details from the
 * environment instead. Skipped unless `ROUTIER_PG_HOST` is set.
 *
 * The plugin renders through `@routier/postgres-plugin-core`'s `toSql`, the same path pglite takes,
 * and pglite runs the shared contract. This is the one that proves the engine agrees.
 */

const host = process.env.ROUTIER_PG_HOST;
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

suite('casing calls against a real PostgreSQL', () => {

    const opened: CasingStore[] = [];

    const config = () => ({
        host: host!,
        port: Number(process.env.ROUTIER_PG_PORT ?? 5432),
        database: process.env.ROUTIER_PG_DATABASE ?? 'routier',
        user: process.env.ROUTIER_PG_USER ?? 'postgres',
        password: process.env.ROUTIER_PG_PASSWORD ?? 'routier',
    });

    // Seeded once, not per case. `destroy` on a real server closes the pool without dropping the
    // database -- postgres-core refuses to drop what it did not create -- so re-seeding would
    // accumulate rows and turn a correct filter into a wrong count.
    let store: CasingStore;

    const seeded = async () => store;

    beforeAll(async () => {
        store = new CasingStore(new PostgresDbPlugin(config()));
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

    // The engine must fold the column, not the comparison: a case-INSENSITIVE match would return
    // the row and hide a plugin that dropped the call
    it('is case-folded rather than case-blind', async () => {
        const store = await seeded();

        expect(await store.products.where(p => p.name.toLowerCase() === 'Bravo').toArrayAsync()).toEqual([]);
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

        const reported = explanation.executionSteps.flatMap(step => step.executedQueries ?? []);

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
});
