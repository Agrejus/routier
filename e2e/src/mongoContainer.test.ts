import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { MongoClient } from 'mongodb';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MongoClientDriver, MongoDbPlugin } from '@routier/mongodb-plugin';
import { executedQueriesOf } from '@routier/core/plugins';

/**
 * Routier against a real MongoDB server.
 *
 * The plugin's own suite runs against `FakeMongoDriver`, which answers the MQL subset the
 * plugin emits — and therefore agrees with whatever the plugin believes. Two things can only
 * be checked here:
 *
 * 1. That the emitted MQL means what the plugin thinks it means.
 * 2. That `withTransaction` behaves as `MongoClientDriver` assumes, including its retry.
 *
 * `MongoDBContainer` starts a SINGLE-NODE REPLICA SET, which matters: a standalone `mongod`
 * rejects transactions outright, so a standalone container would silently exercise the
 * `transactions: "unavailable"` path and prove nothing about atomicity.
 *
 * Opt-in behind E2E_CONTAINERS, like the PostgreSQL and MySQL suites.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

const orders = s.define('e2e_mongo_orders', {
    _id: s.string().key().identity(),
    reference: s.string(),
    total: s.number(),
    tags: s.array(s.string()),
    payload: s.object({ inner: s.object({ value: s.string(), count: s.number() }) }),
}).compile();

const lines = s.define('e2e_mongo_lines', {
    _id: s.string().key().identity(),
    sku: s.string(),
    quantity: s.number(),
}).compile();

class ShopStore extends DataStore {
    orders = this.collection(orders).proxy().create();
    lines = this.collection(lines).proxy().create();
}

suite('MongoDB via testcontainers', () => {
    let container: StartedMongoDBContainer;
    let client: MongoClient;

    beforeAll(async () => {
        container = await new MongoDBContainer('mongo:7').start();
        // `directConnection` is required against a single-node replica set: without it the
        // driver tries to discover other members and never finds a primary.
        client = new MongoClient(container.getConnectionString(), { directConnection: true });
        await client.connect();
    }, 180_000);

    afterAll(async () => {
        await client?.close();
        await container?.stop();
    });

    const open = () => new ShopStore(
        new MongoDbPlugin(new MongoClientDriver(client as never, 'routier_e2e', { transactions: 'required' }))
    );

    afterEach(async () => {
        await client.db('routier_e2e').dropDatabase();
    });

    describe('round trip', () => {
        it('writes and reads an entity, keeping the client-assigned _id', async () => {
            const store = open();
            const [added] = await store.orders.addAsync({
                reference: 'A-1', total: 10, tags: ['x'],
                payload: { inner: { value: 'a', count: 1 } },
            } as any);
            await store.saveChangesAsync();

            const reread: any = await open().orders.firstAsync();

            expect(reread._id).toBe(added._id);
            expect(reread.reference).toBe('A-1');
            // Nested objects and arrays are native here — no JSON column to decode.
            expect(reread.payload.inner).toEqual({ value: 'a', count: 1 });
            expect(reread.tags).toEqual(['x']);
        });
    });

    describe('filters reach the server', () => {
        const seed = async () => {
            const store = open();
            await store.orders.addAsync(
                { reference: 'alpha', total: 10, tags: ['x'], payload: { inner: { value: 'a', count: 1 } } } as any,
                { reference: 'beta', total: 100, tags: ['y'], payload: { inner: { value: 'b', count: 20 } } } as any,
                { reference: 'gamma', total: 50, tags: ['x', 'z'], payload: { inner: { value: 'c', count: 3 } } } as any,
            );
            await store.saveChangesAsync();
        };

        it('filters on a scalar', async () => {
            await seed();
            const found = await open().orders.where(x => x.reference === 'beta').toArrayAsync();
            expect(found.map((x: any) => x.reference)).toEqual(['beta']);
        });

        it('explains a query: reports the find it executed', async () => {
            await seed();
            const { data, explanation } = await open().orders
                .where(x => x.reference === 'beta')
                .explain()
                .toArrayAsync();

            expect(data.map(x => x.reference)).toEqual(['beta']);

            const reported = executedQueriesOf(explanation);
            expect(reported.length).toBeGreaterThan(0);
            expect(reported[0].text).toContain('.find(');
            expect(reported[0].text).toContain('beta');
        });

        it('filters on a nested property with dot notation', async () => {
            await seed();
            const found = await open().orders.where(x => (x as any).payload.inner.value === 'c').toArrayAsync();
            expect(found.map((x: any) => x.reference)).toEqual(['gamma']);
        });

        it('compares a nested number numerically', async () => {
            await seed();
            // Text comparison would answer this wrongly: '10' > '9' is false.
            const found = await open().orders.where(x => (x as any).payload.inner.count > 9).toArrayAsync();
            expect(found.map((x: any) => x.reference)).toEqual(['beta']);
        });

        it('treats array equality as membership', async () => {
            await seed();
            const found = await open().orders.where(x => x.tags.includes('x')).toArrayAsync();
            expect(found.map((x: any) => x.reference).sort()).toEqual(['alpha', 'gamma']);
        });

        it('mirrors a comparison written with the literal on the left', async () => {
            await seed();
            // `50 > total` means total < 50 — emitted as { total: { $lt: 50 } }.
            const found = await open().orders.where(x => 50 > x.total).toArrayAsync();
            expect(found.map((x: any) => x.reference)).toEqual(['alpha']);
        });

        it('sorts, skips and takes on the server', async () => {
            await seed();
            const found = await open().orders.sort(x => x.total).skip(1).take(1).toArrayAsync();
            expect(found.map((x: any) => x.reference)).toEqual(['gamma']);
        });
    });

    describe('updates', () => {
        it('keeps unchanged siblings when one nested value changes', async () => {
            const store = open();
            await store.orders.addAsync({
                reference: 'B-1', total: 5, tags: [],
                payload: { inner: { value: 'before', count: 9 } },
            } as any);
            await store.saveChangesAsync();

            const editor = open();
            const target: any = await editor.orders.firstAsync();
            target.payload.inner.value = 'after';
            await editor.saveChangesAsync();

            const reread: any = await open().orders.firstAsync();

            expect(reread.payload.inner.value).toBe('after');
            // A whole-subtree $set would have dropped this. The delta is flattened to a
            // dotted path precisely so it survives.
            expect(reread.payload.inner.count).toBe(9);
        });
    });

    describe('atomicity', () => {
        /**
         * The claim the transaction exists for, against a real replica set.
         *
         * `lines` is written after `orders`. Making the second write fail must undo the
         * first — on a standalone server, or without a session, the order would survive.
         */
        it('rolls back a write to the first collection when the second fails', async () => {
            const store = open();
            await store.orders.addAsync({
                reference: 'C-1', total: 1, tags: [],
                payload: { inner: { value: 'v', count: 0 } },
            } as any);
            // The second collection's write is made to fail with a duplicate key.
            const duplicate = 'fixed-id';
            await client.db('routier_e2e').collection('e2e_mongo_lines').insertOne({ _id: duplicate as never, sku: 'pre', quantity: 1 });
            await store.lines.addAsync({ _id: duplicate, sku: 'z', quantity: 5 } as any);

            await expect(store.saveChangesAsync()).rejects.toThrow();

            const survivingOrders = await client.db('routier_e2e').collection('e2e_mongo_orders').countDocuments();

            expect(survivingOrders).toBe(0);
        });

        /**
         * The control for the test above.
         *
         * A rollback assertion passes trivially if the first write never happened — so this
         * runs the identical scenario with `transactions: "unavailable"` and asserts the
         * order DOES survive. That is what makes the previous case evidence about the
         * transaction rather than about the ordering of two writes.
         */
        it('leaves the first collection written when transactions are unavailable', async () => {
            const store = new ShopStore(
                new MongoDbPlugin(
                    new MongoClientDriver(client as never, 'routier_e2e', { transactions: 'unavailable' })
                )
            );

            await store.orders.addAsync({
                reference: 'C-3', total: 1, tags: [],
                payload: { inner: { value: 'v', count: 0 } },
            } as any);

            const duplicate = 'fixed-id-2';
            await client.db('routier_e2e').collection('e2e_mongo_lines').insertOne({ _id: duplicate as never, sku: 'pre', quantity: 1 });
            await store.lines.addAsync({ _id: duplicate, sku: 'z', quantity: 5 } as any);

            await expect(store.saveChangesAsync()).rejects.toThrow();

            const survivingOrders = await client.db('routier_e2e').collection('e2e_mongo_orders').countDocuments();

            // Not a bug — the documented consequence of running without a session, and the
            // reason `transactions` is stated at construction rather than detected.
            expect(survivingOrders).toBe(1);
        });

        it('commits both collections together on success', async () => {
            const store = open();
            await store.orders.addAsync({
                reference: 'C-2', total: 2, tags: [],
                payload: { inner: { value: 'v', count: 0 } },
            } as any);
            await store.lines.addAsync({ sku: 'ok', quantity: 3 } as any);

            await store.saveChangesAsync();

            const db = client.db('routier_e2e');
            expect(await db.collection('e2e_mongo_orders').countDocuments()).toBe(1);
            expect(await db.collection('e2e_mongo_lines').countDocuments()).toBe(1);
        });
    });
});
