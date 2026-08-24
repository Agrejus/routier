import { ShopStore } from './store';

export type OpContext = {
    /** A known email from the seed data, for the point-lookup op. */
    email: string;
};

/**
 * The queries every database runs. This file is displayed verbatim in the UI,
 * so what you read here is exactly what executed.
 */
export const OPS = [
    {
        name: 'Count all',
        run: async (store: ShopStore, _ctx: OpContext) => {
            const n = await store.orders.countAsync();
            return `${n.toLocaleString()} rows`;
        },
    },
    {
        name: 'Read all rows',
        run: async (store: ShopStore, _ctx: OpContext) => {
            const all = await store.orders.toArrayAsync();
            return `${all.length.toLocaleString()} rows`;
        },
    },
    {
        name: 'Filter: pending orders in EU',
        run: async (store: ShopStore, _ctx: OpContext) => {
            const rows = await store.orders
                .where(([o, p]) => o.status === p.status && o.region === p.region, { status: 'pending', region: 'eu' })
                .toArrayAsync();
            return `${rows.length.toLocaleString()} rows`;
        },
    },
    {
        name: 'Page: newest 25, skip 1000',
        run: async (store: ShopStore, _ctx: OpContext) => {
            const rows = await store.orders
                .sortDescending(o => o.createdAt)
                .skip(1000)
                .take(25)
                .toArrayAsync();
            return `${rows.length} rows`;
        },
    },
    {
        name: 'Sum: revenue of paid orders',
        run: async (store: ShopStore, _ctx: OpContext) => {
            const revenue = await store.orders
                .where(([o, p]) => o.status === p.status, { status: 'paid' })
                .sumAsync(o => o.total);
            return `$${Math.round(revenue).toLocaleString()}`;
        },
    },
    {
        name: 'Find one order by email',
        run: async (store: ShopStore, ctx: OpContext) => {
            const row = await store.orders.firstOrUndefinedAsync(([o, p]) => o.email === p.email, { email: ctx.email });
            return row == null ? 'MISSING' : 'found';
        },
    },
    {
        name: 'Update 500 orders + save',
        run: async (store: ShopStore, _ctx: OpContext) => {
            const toShip = await store.orders
                .where(([o, p]) => o.status === p.status, { status: 'paid' })
                .take(500)
                .toArrayAsync();
            for (const order of toShip) {
                order.status = 'shipped';
            }
            await store.saveChangesAsync();
            lastShipped = toShip;
            return `${toShip.length} rows`;
        },
        // Put those exact 500 back so every database holds identical rows when you migrate on.
        cleanup: async (store: ShopStore) => {
            for (const order of lastShipped) {
                order.status = 'paid';
            }
            await store.saveChangesAsync();
            lastShipped = [];
        },
    },
];

let lastShipped: { status: string }[] = [];

/**
 * The same filter as the "pending orders in EU" op, with `.explain()` in the chain.
 * The result carries the pushdown analysis and the statements the plugin reports
 * having executed, so you can see what each database actually ran.
 */
export function explainFilter(store: ShopStore) {
    return store.orders
        .where(([o, p]) => o.status === p.status && o.region === p.region, { status: 'pending', region: 'eu' })
        .explain()
        .toArrayAsync();
}
