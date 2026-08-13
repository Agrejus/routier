import { describe, it, expect, afterEach } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { createRequestHandler, SerializedRequest } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpTransportDbPlugin } from './HttpTransportDbPlugin';

/**
 * Authorization and row scoping on the receiving end.
 *
 * The library supplies no policy — no user, no tenant, no role — because it cannot know what yours
 * are. What it supplies is two places a decision cannot be forgotten, and the guarantee that both are
 * enforced where the caller cannot reach: on reads, on writes, and through a join.
 *
 * Every request below crosses a real JSON boundary, and the client is a store with no database.
 */
const orderSchema = s.define('sec_orders', {
    _id: s.string().key().identity(),
    tenantId: s.string(),
    reference: s.string(),
}).compile();

const lineSchema = s.define('sec_lines', {
    _id: s.string().key().identity(),
    orderId: s.string().nullable(),
    tenantId: s.string(),
    sku: s.string(),
}).compile();

class Store extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    orders = this.collection(orderSchema).proxy().create();
    lines = this.collection(lineSchema).proxy().create();
}

type Context = { tenantId: string | null };

const stores: DataStore[] = [];

/**
 * A server holding both tenants' rows, and a client that connects AS one of them.
 *
 * The server store is seeded directly — bypassing the endpoint — so the data the scope has to hide
 * genuinely exists. A test that only ever wrote through the scope could not tell hiding from absence.
 */
const connected = async (handlerOptions: {
    authorize?: Parameters<typeof createRequestHandler<Context>>[0]['authorize'];
    scope?: Parameters<typeof createRequestHandler<Context>>[0]['scope'];
    allowDestroy?: boolean;
}) => {
    const plugin = new MemoryPlugin(uuidv4());
    const server = new Store(plugin);
    stores.push(server);

    const [mine, theirs] = await server.orders.addAsync(
        { tenantId: 'mine', reference: 'ORD-1' },
        { tenantId: 'theirs', reference: 'ORD-2' },
    );
    await server.saveChangesAsync();

    await server.lines.addAsync(
        { orderId: mine._id, tenantId: 'mine', sku: 'A' },
        { orderId: theirs._id, tenantId: 'theirs', sku: 'B' },
    );
    await server.saveChangesAsync();

    const handle = createRequestHandler<Context>({ plugin, schemas: server.schemas, ...handlerOptions });

    /** Connects as `tenantId` — the context a route would have built from the request. */
    const clientAs = (tenantId: string | null) => {
        const client = new Store(new HttpTransportDbPlugin({
            url: 'https://api.test/routier',
            request: async (_url, body) => {
                const overTheWire = JSON.parse(JSON.stringify(body)) as SerializedRequest;
                return JSON.parse(JSON.stringify(await handle(overTheWire, { tenantId })));
            },
        }));
        stores.push(client);
        return client;
    };

    return { server, clientAs, mine, theirs };
};

/** The scope every test below uses: rows whose tenant matches the caller's. */
const tenantScope: Parameters<typeof createRequestHandler<Context>>[0]['scope'] = ({ context }) => ({
    filter: ([row, p]: [any, any]) => row.tenantId === p.tenantId,
    params: { tenantId: context.tenantId },
});

describe('securing the endpoint', () => {

    afterEach(async () => {
        await Promise.all(stores.splice(0).map(store => store.destroyAsync().catch(() => undefined)));
    });

    describe('authorize', () => {

        it('refuses before anything is deserialized or executed', async () => {
            const { clientAs } = await connected({
                authorize: ({ context }) => context.tenantId != null || 'not signed in',
            });

            await expect(clientAs(null).orders.toArrayAsync()).rejects.toThrow(/not signed in/);
        });

        it('allows a caller it recognises', async () => {
            const { clientAs } = await connected({
                authorize: ({ context }) => context.tenantId != null,
            });

            expect(await clientAs('mine').orders.countAsync()).toBe(2);
        });

        it('is told every collection the request touches, joins included', async () => {
            const seen: string[][] = [];

            const { clientAs } = await connected({
                authorize: ({ collectionNames }) => {
                    seen.push([...collectionNames].sort());
                    return true;
                },
            });

            await clientAs('mine').orders.join(s => s.lines, o => o._id, l => l.orderId).toArrayAsync();

            // Both sides, so a policy can refuse a join to a collection it would refuse directly
            expect(seen.at(-1)).toEqual(['sec_lines', 'sec_orders']);
        });

        it('can refuse by action, so an endpoint can be read-only', async () => {
            const { clientAs } = await connected({
                authorize: ({ action }) => action === 'query' || 'this endpoint is read-only',
            });

            const client = clientAs('mine');

            expect(await client.orders.countAsync()).toBe(2);

            await client.orders.addAsync({ tenantId: 'mine', reference: 'ORD-3' });
            await expect(client.saveChangesAsync()).rejects.toThrow(/read-only/);
        });
    });

    describe('scope, on reads', () => {

        it('hides rows belonging to another caller', async () => {
            const { clientAs } = await connected({ scope: tenantScope });

            const orders = await clientAs('mine').orders.toArrayAsync();

            expect(orders.map(o => o.reference)).toEqual(['ORD-1']);
        });

        it('cannot be widened by the caller\'s own filter', async () => {
            const { clientAs } = await connected({ scope: tenantScope });

            // Asking explicitly for the other tenant returns nothing: the scope is ANDed, not replaced
            const orders = await clientAs('mine').orders.where(o => o.tenantId === 'theirs').toArrayAsync();

            expect(orders).toEqual([]);
        });

        it('applies to an aggregate as well as to rows', async () => {
            const { clientAs } = await connected({ scope: tenantScope });

            expect(await clientAs('mine').orders.countAsync()).toBe(1);
        });

        /**
         * The bypass worth having a test for.
         *
         * A join READS a second collection. If the scope were applied only to the collection named in
         * the request, a caller could reach an unscoped view of any other collection by joining to it.
         */
        it('applies to the inner side of a join, so a join is not a way around it', async () => {
            const { clientAs } = await connected({ scope: tenantScope });

            const pairs = await clientAs('mine').orders
                .leftJoin(s => s.lines, o => o._id, l => l.orderId)
                .map(([order, line]) => `${order.reference}:${line?.sku ?? '-'}`)
                .toArrayAsync();

            // Only my order, and only my line
            expect(pairs).toEqual(['ORD-1:A']);
        });

        it('lets a scope apply to one collection and not another', async () => {
            const { clientAs } = await connected({
                scope: ({ collectionName, context }) => collectionName !== 'sec_orders'
                    ? null
                    : { filter: ([row, p]: [any, any]) => row.tenantId === p.tenantId, params: { tenantId: context.tenantId } },
            });

            const client = clientAs('mine');

            expect(await client.orders.countAsync()).toBe(1);
            expect(await client.lines.countAsync()).toBe(2);
        });
    });

    describe('scope, on writes', () => {

        it('accepts a row inside the scope', async () => {
            const { clientAs } = await connected({ scope: tenantScope });
            const client = clientAs('mine');

            await client.orders.addAsync({ tenantId: 'mine', reference: 'ORD-3' });
            await client.saveChangesAsync();

            expect(await client.orders.countAsync()).toBe(2);
        });

        /**
         * On a read a scope narrows what comes back; on a write there is nothing to narrow, so each
         * row is checked. Without this a caller who can only READ their own rows could still WRITE
         * somebody else's.
         */
        it('refuses a row outside the scope', async () => {
            const { clientAs } = await connected({ scope: tenantScope });
            const client = clientAs('mine');

            await client.orders.addAsync({ tenantId: 'theirs', reference: 'SMUGGLED' });

            await expect(client.saveChangesAsync()).rejects.toThrow(/falls outside the scope/);
        });

        it('refuses the whole save when any one row is outside the scope', async () => {
            const { clientAs, server } = await connected({ scope: tenantScope });
            const client = clientAs('mine');

            await client.orders.addAsync(
                { tenantId: 'mine', reference: 'FINE' },
                { tenantId: 'theirs', reference: 'SMUGGLED' },
            );

            await expect(client.saveChangesAsync()).rejects.toThrow(/falls outside the scope/);

            // Neither row was written — a partial save would leave the caller believing both landed
            expect(await server.orders.countAsync()).toBe(2);
        });
    });

    describe('destroy', () => {

        // The transport never sends one, but an endpoint answers whatever arrives. A hand-written
        // payload must not be able to drop the database.
        it('is refused by default, even for a hand-written payload', async () => {
            const plugin = new MemoryPlugin(uuidv4());
            const server = new Store(plugin);
            stores.push(server);

            await server.orders.addAsync({ tenantId: 'mine', reference: 'ORD-1' });
            await server.saveChangesAsync();

            const handle = createRequestHandler({ plugin, schemas: server.schemas });
            const response = await handle({ kind: 'destroy' });

            expect(response.ok).toBe(false);
            expect(await server.orders.countAsync()).toBe(1);
        });

        it('is allowed only when opted into, and still passes through authorize', async () => {
            const plugin = new MemoryPlugin(uuidv4());
            const server = new Store(plugin);
            stores.push(server);

            const refused = createRequestHandler<Context>({
                plugin,
                schemas: server.schemas,
                allowDestroy: true,
                authorize: ({ action }) => action !== 'destroy' || 'destroy is not for you',
            });

            expect(await refused({ kind: 'destroy' }, { tenantId: 'mine' })).toEqual({
                ok: false,
                error: 'destroy is not for you',
            });

            const allowed = createRequestHandler({ plugin, schemas: server.schemas, allowDestroy: true });

            expect((await allowed({ kind: 'destroy' })).ok).toBe(true);
        });
    });

    /**
     * A filter whose intent is unknown never reaches the wire.
     *
     * `not-parsable` means the parser could not work out what the predicate asks for. A receiver
     * handed that could only read everything or return nothing, and both answers are wrong — so the
     * option stays in the memory half, where the caller's own closure answers correctly.
     */
    it('runs a filter it could not parse locally rather than sending it', async () => {
        const { clientAs } = await connected({});
        const client = clientAs('mine');

        // A closure over an outer variable: the parser cannot derive its value from source text
        const wanted = 'ORD-1';
        const orders = await client.orders.toQueryable().where(o => o.reference === wanted).toArrayAsync();

        expect(orders.map(o => o.reference)).toEqual(['ORD-1']);
    });

    /**
     * A scope that cannot be turned into an expression is REFUSED, not ignored.
     *
     * It is the boundary between callers. One that quietly stops applying is worse than an error, so
     * an unparseable filter fails the request rather than degrading to no scope at all.
     */
    it('refuses a scope it cannot express as a filter', async () => {
        const { clientAs } = await connected({
            scope: () => ({ filter: (() => Math.random() > 0.5) as never }),
        });

        await expect(clientAs('mine').orders.toArrayAsync()).rejects.toThrow(/cannot be expressed as a filter/);
    });
});
