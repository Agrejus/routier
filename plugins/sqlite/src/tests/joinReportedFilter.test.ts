import { afterAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';

const productSchema = s.define('join_reported_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number()
}).compile();

const tagSchema = s.define('join_reported_tags', {
    _id: s.string().key().identity(),
    productId: s.string(),
    label: s.string()
}).compile();

class ReportedJoinDataStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
    tags = this.collection(tagSchema).proxy().create();
}

describe('a join whose outer filter the engine cannot render', () => {

    const stores: ReportedJoinDataStore[] = [];

    const seeded = async () => {
        const store = new ReportedJoinDataStore(new SqliteDbPlugin(`join-reported-${uuidv4()}.sqlite`));
        stores.push(store);

        const [alpha, bravo, charlie] = await store.products.addAsync(
            { name: 'Alpha', price: 10 },
            { name: 'Bravo', price: 30 },
            { name: 'Charlie', price: 40 }
        );

        await store.saveChangesAsync();

        await store.tags.addAsync(
            { productId: alpha._id, label: 'a' },
            { productId: bravo._id, label: 'b' },
            { productId: charlie._id, label: 'c' }
        );

        await store.saveChangesAsync();

        return store;
    };

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    it('pairs only the rows the filter keeps', async () => {
        const store = await seeded();

        const pairs = await store.products
            .where(product => product.price ** 2 > 400)
            .join(x => x.tags, product => product._id, tag => tag.productId)
            .toArrayAsync();

        expect(pairs.map(([product]) => product.name).toSorted()).toEqual(['Bravo', 'Charlie']);
    });

    it('answers the same as the renderable filter that selects the same rows', async () => {
        const store = await seeded();

        const control = await store.products
            .where(product => product.price > 20)
            .join(x => x.tags, product => product._id, tag => tag.productId)
            .toArrayAsync();

        expect(control.map(([product]) => product.name).toSorted()).toEqual(['Bravo', 'Charlie']);
    });
});
