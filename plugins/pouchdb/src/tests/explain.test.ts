import { afterAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { executedQueriesOf } from '@routier/core/plugins';
import { DataStore } from '@routier/datastore';
import { PouchDbPlugin } from '../PouchDbPlugin';

const orderSchema = s.define('explain_orders', {
    _id: s.string().key().identity(),
    status: s.string().index(),
    amount: s.number(),
}).compile();

class Store extends DataStore {
    orders = this.collection(orderSchema).proxy().create();
}

const stores: Store[] = [];

afterAll(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync();
    }
});

const seeded = async () => {
    const store = new Store(new PouchDbPlugin(uuidv4()));

    stores.push(store);
    await store.orders.addAsync({ status: 'paid', amount: 10 }, { status: 'open', amount: 20 });
    await store.saveChangesAsync();

    return store;
};

describe("PouchDB's executed query", () => {
    it('is allDocs for a read with no filter', async () => {
        const { explanation } = await (await seeded()).orders.explain().toArrayAsync();

        expect(executedQueriesOf(explanation)).toEqual([{ text: 'db.allDocs({ include_docs: true })', language: 'pouchdb', note: 'a full database read, no index' }]);
    });

    it('is a temporary view for a filter no index serves', async () => {
        const { data, explanation } = await (await seeded()).orders.where(x => x.amount > 15).explain().toArrayAsync();

        expect(data.map(x => x.amount)).toEqual([20]);
        expect(executedQueriesOf(explanation)).toEqual([{
            text: 'db.query((doc, emit) => {\n  if (doc.amount > ?) emit(doc._id, doc);\n})',
            parameters: [15],
            language: 'pouchdb',
            note: 'a temporary view: PouchDB runs the map function over every document',
        }]);
    });

    it('is the index view, keyed by the value, for a filter an index serves', async () => {
        const { data, explanation } = await (await seeded()).orders.where(x => x.status === 'paid').explain().toArrayAsync();
        const [query] = executedQueriesOf(explanation);

        expect(data.map(x => x.amount)).toEqual([10]);
        expect(query.text).toMatch(/^db\.query\("[^"]+", \{ key: \?, include_docs: true \}\)\n  \.then\(\(\{ rows \}\) => rows\.map\(row => row\.doc\)\.filter\(doc => doc\.status === \?\)\)$/);
        expect(query.parameters).toEqual(['paid', 'paid']);
        expect(query.note).toBe('an indexed view query');
    });
});
