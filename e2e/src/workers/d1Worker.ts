import { DataStore } from '@routier/datastore';
import { InferType, s } from '@routier/core/schema';
import { D1DbPlugin, type D1Database } from '@routier/sqlite-plugin/d1';

interface Env {
    DB: D1Database;
}

const orderSchema = s.define('worker_orders', {
    id: s.string().key().identity(),
    customer: s.string(),
    total: s.number(),
    placedAt: s.date(),
}).compile();

type Order = InferType<typeof orderSchema>;

class ShopStore extends DataStore {
    orders = this.collection(orderSchema).proxy().create();

    constructor(env: Env) {
        super(new D1DbPlugin(env.DB));
    }
}

const describeOrders = (orders: Order[]) => orders.map(order => ({
    customer: order.customer,
    total: order.total,
    placedAtIsDate: order.placedAt instanceof Date,
    placedAt: order.placedAt instanceof Date ? order.placedAt.toISOString() : String(order.placedAt),
}));

const seed = async (store: ShopStore) => {
    await store.orders.addAsync(
        { customer: 'ada', total: 40, placedAt: new Date('2026-01-02T03:04:05.678Z') },
        { customer: 'bob', total: 15, placedAt: new Date('2026-02-01T00:00:00.000Z') },
        { customer: 'cy', total: 99, placedAt: new Date('2026-03-01T12:00:00.000Z') },
    );
    await store.saveChangesAsync();
    return { seeded: await store.orders.countAsync() };
};

const query = async (store: ShopStore) => {
    const since = new Date('2026-01-15T00:00:00.000Z');
    return {
        overTwenty: describeOrders(await store.orders.where(order => order.total > 20).sort(order => order.total).toArrayAsync()),
        placedSince: describeOrders(await store.orders
            .where(([order, params]: [Order, { since: Date }]) => order.placedAt > params.since, { since })
            .sort(order => order.customer)
            .toArrayAsync()),
        count: await store.orders.countAsync(),
        sum: await store.orders.sumAsync(order => order.total),
    };
};

const mutate = async (store: ShopStore) => {
    const bob = await store.orders.firstAsync(order => order.customer === 'bob');
    bob.total = 25;
    const cy = await store.orders.firstAsync(order => order.customer === 'cy');
    await store.orders.removeAsync(cy);
    await store.saveChangesAsync();
    return query(store);
};

const live = async (store: ShopStore) => {
    const deliveries: number[] = [];
    store.orders.subscribe().count(result => {
        if (result.ok === 'success') deliveries.push(result.data);
    });
    await store.orders.addAsync({ customer: 'dee', total: 5, placedAt: new Date('2026-04-01T00:00:00.000Z') });
    await store.saveChangesAsync();

    const deadline = Date.now() + 2000;
    while (!deliveries.includes(await store.orders.countAsync()) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    return { deliveries };
};

const routes: Record<string, (store: ShopStore) => Promise<object>> = {
    '/seed': seed,
    '/query': query,
    '/mutate': mutate,
    '/live': live,
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const route = routes[new URL(request.url).pathname];
        if (route == null) return Response.json({ error: 'unknown route' }, { status: 404 });
        try {
            return Response.json(await route(new ShopStore(env)));
        } catch (error) {
            return Response.json({ error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }, { status: 500 });
        }
    },
};
