import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { MongoClient } from 'mongodb';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MongoClientDriver, MongoDbPlugin } from '@routier/mongodb-plugin';

/**
 * Casing calls against a real MongoDB.
 *
 * `mongoContainer.test.ts` cannot start a container in every environment — its log-wait strategy
 * fails where the Docker log stream closes early — so this takes a connection string instead.
 * Skipped unless `ROUTIER_MONGO_URL` is set. It must point at a replica set: the plugin requires
 * transactions.
 *
 * A casing call cannot be a field key, so all of these take the `$expr` path with `$toLower` /
 * `$toUpper`. `FakeMongoDriver` answers only the subset the plugin already believed in, so this is
 * the only place the engine gets a say.
 */

const url = process.env.ROUTIER_MONGO_URL;
const suite = url == null ? describe.skip : describe;

const products = s.define('casing_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

class CasingStore extends DataStore {
    products = this.collection(products).proxy().create();
}

suite('casing calls against a real MongoDB', () => {
    let client: MongoClient;

    beforeAll(async () => {
        client = new MongoClient(url!, { directConnection: true });
        await client.connect();
    }, 120_000);

    afterAll(async () => {
        await client?.close();
    });

    afterEach(async () => {
        await client.db('routier_casing').dropDatabase();
    });

    const seeded = async () => {
        const store = new CasingStore(
            new MongoDbPlugin(new MongoClientDriver(client as never, 'routier_casing', { transactions: 'required' }))
        );

        await store.products.addAsync(
            { name: 'Alpha', category: 'tools', price: 10 } as never,
            { name: 'Bravo', category: 'tools', price: 30 } as never,
            { name: 'Charlie', category: 'toys', price: 20 } as never,
            { name: 'Delta', category: 'toys', price: 40 } as never,
        );
        await store.saveChangesAsync();

        return store;
    };

    it('filters through a lower-case call, which becomes $toLower inside $expr', async () => {
        const found = await (await seeded()).products.where(p => p.name.toLowerCase() === 'bravo').toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    it('filters through an upper-case call', async () => {
        const found = await (await seeded()).products.where(p => p.category.toUpperCase() === 'TOYS').toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Charlie', 'Delta']);
    });

    // $expr must fold the FIELD, not compare case-insensitively: a case-blind match returns the
    // row and hides a plugin that dropped the call
    it('is case-folded rather than case-blind', async () => {
        const found = await (await seeded()).products.where(p => p.name.toLowerCase() === 'Bravo').toArrayAsync();

        expect(found).toEqual([]);
    });

    it('filters through a call on a relational comparator', async () => {
        const found = await (await seeded()).products.where(p => p.name.toLowerCase() > 'b').toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Bravo', 'Charlie', 'Delta']);
    });

    it('filters through a call on both sides of a comparison', async () => {
        const found = await (await seeded()).products
            .where(p => p.name.toLowerCase() === p.category.toLowerCase())
            .toArrayAsync();

        expect(found).toEqual([]);
    });

    it('filters through a call inside a string match, which is $regexMatch', async () => {
        const found = await (await seeded()).products.where(p => p.name.toLowerCase().startsWith('br')).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Bravo']);
    });

    it('filters through modulo, which is $mod', async () => {
        const found = await (await seeded()).products.where(p => p.price % 20 === 0).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Charlie', 'Delta']);
    });

    it('filters through multiplication by a float', async () => {
        const found = await (await seeded()).products.where(p => p.price * 1.5 > 45).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Delta']);
    });

    it('filters through division', async () => {
        const found = await (await seeded()).products.where(p => p.price / 10 === 2).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Charlie']);
    });

    it('gives multiplication precedence over addition', async () => {
        const found = await (await seeded()).products.where(p => p.price + 3 * 4 === 22).toArrayAsync();

        expect(found.map(p => p.name)).toEqual(['Alpha']);
    });
});
