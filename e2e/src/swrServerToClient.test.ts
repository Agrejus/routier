import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { uuid } from '@routier/core/utilities';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from '@routier/replication-plugin';
import { startSyncServer, type SyncServer } from '@routier/sync-server';

/**
 * SERVER → CLIENT: what happens when the server changes and the client did not ask.
 *
 * Every replication test written before this one drives the server through the client —
 * write, flush, read back — which only ever exercises client→server. The audit put the ratio
 * at roughly 1 : 3.6, and found that no test anywhere watches the client drop a row the
 * server deleted, through the public API. The one assertion that a revalidate removes
 * anything reaches past the API and calls the private `persistToStore`.
 *
 * These scenarios use `@routier/sync-server`, whose whole purpose is the admin channel: it
 * can delete, patch and insert rows with the client uninvolved, which is the only way to
 * write "another user did something" as a test.
 *
 * Two things to know about how a revalidate is triggered, because they shape every test here:
 *
 *  1. It is strictly pull. Nothing revalidates on a timer — `syncNow()`, the `online` event
 *     and the background flush all drain WRITES. A read is the only trigger.
 *  2. A read only revalidates when its cache key is stale (`maxAgeMs`, default 60s). These
 *     tests set `maxAgeMs: 0` so every read revalidates, rather than sleeping.
 */

const productSchema = s.define('swr_products', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

const COLLECTION = 'swr_products';

describe('SWR server-to-client', () => {
    let server: SyncServer;
    const stores: DataStore[] = [];

    /**
     * A client with its own SWR store and queue.
     *
     * `maxAgeMs: 0` makes every read revalidate — the alternative is sleeping past a 60s
     * default, which would make these tests unbearable and no more truthful.
     */
    const connect = (options: { maxAgeMs?: number } = {}) => {
        const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);

        const plugin = new HttpSwrDbPlugin(swrStore, {
            getUrl: collection => server.url(collection),
            unsyncedQueueStore: queueStore,
            maxAgeMs: options.maxAgeMs ?? 0,
            writeBatchDelayMs: 0,
            bulkPersistRetryMaxAttempts: 1,
            // No background flush: these are read-path tests and a timer firing mid-assertion
            // only adds noise.
            autoSync: false,
        });

        const store = new ProductStore(plugin);
        stores.push(store);

        return store;
    };

    /**
     * Reads until `predicate` holds, or gives up.
     *
     * A revalidate is scheduled on `setTimeout(0)` AFTER the cached rows are returned, so the
     * read that triggers it returns the OLD data by design — that is what
     * stale-while-revalidate means. The caller therefore has to read again to observe the
     * result, and polling is how a test expresses "eventually" without guessing a delay.
     */
    const readUntil = async (
        store: ProductStore,
        predicate: (rows: { id: string; name: string; price: number }[]) => boolean,
        what: string,
        attempts = 40
    ) => {
        let last: any[] = [];

        for (let attempt = 0; attempt < attempts; attempt++) {
            last = await store.products.toArrayAsync();

            if (predicate(last as never)) {
                return last;
            }

            await new Promise(resolve => setTimeout(resolve, 25));
        }

        throw new Error(
            `${what} — after ${attempts} reads the client still had: ` +
            JSON.stringify(last.map((r: any) => ({ id: r.id, name: r.name, price: r.price })))
        );
    };

    beforeEach(async () => {
        server = await startSyncServer();
    });

    afterEach(async () => {
        for (const store of stores.splice(0)) {
            await store.destroyAsync().catch(() => undefined);
        }

        await server.stop();
    });

    describe('a row the server deleted', () => {
        it('reaches the client on the next read', async () => {
            server.admin.seed(COLLECTION, [
                { id: 'a', name: 'Alpha', price: 10 },
                { id: 'b', name: 'Bravo', price: 20 },
            ]);

            const client = connect();

            expect((await client.products.toArrayAsync()).map(p => p.id).sort()).toEqual(['a', 'b']);

            // Another user deletes it. The client is not told and does not ask.
            server.admin.remove(COLLECTION, ['a']);

            const rows = await readUntil(
                client,
                r => r.length === 1,
                'the server deleted a row and the client never dropped it'
            );

            expect(rows.map((r: any) => r.id)).toEqual(['b']);
        });

        it('does not come back on a later read', async () => {
            // Guards the resurrection shape: a delete that propagates once and is then undone
            // by the next revalidate is worse than one that never propagates.
            server.admin.seed(COLLECTION, [{ id: 'a', name: 'Alpha', price: 10 }]);

            const client = connect();
            await client.products.toArrayAsync();

            server.admin.remove(COLLECTION, ['a']);
            await readUntil(client, r => r.length === 0, 'delete did not propagate');

            for (let i = 0; i < 5; i++) {
                expect(await client.products.countAsync()).toBe(0);
            }
        });

        it('is kept while the client has an unsynced change for it', async () => {
            // The documented shield: a locally-touched row survives a server delete until the
            // change is confirmed or dead-lettered. Asserting it here means the policy is real
            // and not just prose.
            server.admin.seed(COLLECTION, [{ id: 'a', name: 'Alpha', price: 10 }]);

            const client = connect();

            // Read first, while the server still answers — the shield protects a row the
            // client already has, so the cache has to be warm before anything is broken.
            const [row] = await client.products.toArrayAsync();

            // Now the server refuses everything, so the local edit cannot be confirmed and
            // the change stays unsynced.
            server.failNextRequests = 1000;

            (row as any).price = 999;
            await client.saveChangesAsync().catch(() => undefined);

            server.admin.remove(COLLECTION, ['a']);

            // Reads still fail (the server is refusing everything), so allow them to error and
            // assert the row is still locally present.
            for (let i = 0; i < 5; i++) {
                await client.products.toArrayAsync().catch(() => undefined);
            }

            server.failNextRequests = 0;

            const kept = await client.products.toArrayAsync();
            expect(kept.map(p => p.id)).toEqual(['a']);
            expect((kept[0] as any).price).toBe(999);
        });
    });

    describe('a row the server changed', () => {
        it('reaches the client on the next read', async () => {
            server.admin.seed(COLLECTION, [{ id: 'a', name: 'Alpha', price: 10 }]);

            const client = connect();
            await client.products.toArrayAsync();

            server.admin.patch(COLLECTION, 'a', { price: 42 });

            const rows = await readUntil(
                client,
                r => r.length === 1 && r[0].price === 42,
                'the server changed a price and the client never saw it'
            );

            expect((rows[0] as any).price).toBe(42);
        });

        it('a row the server added reaches the client', async () => {
            server.admin.seed(COLLECTION, [{ id: 'a', name: 'Alpha', price: 10 }]);

            const client = connect();
            await client.products.toArrayAsync();

            server.admin.upsert(COLLECTION, [{ id: 'b', name: 'Bravo', price: 20 }]);

            const rows = await readUntil(
                client,
                r => r.length === 2,
                'the server added a row and the client never saw it'
            );

            expect(rows.map((r: any) => r.id).sort()).toEqual(['a', 'b']);
        });
    });

    describe('two clients, one server', () => {
        it("one client's write becomes visible to the other", async () => {
            // The flow the SWR plugin is for, and which nothing tested: A writes, the server
            // stores it, B — which never spoke to A — reads it.
            server.admin.seed(COLLECTION, []);

            const clientA = connect();
            const clientB = connect();

            await clientB.products.toArrayAsync();

            await clientA.products.addAsync({ id: 'made-by-a', name: 'From A', price: 5 } as never);
            await clientA.saveChangesAsync();

            await readUntil(
                clientB,
                r => r.some(x => x.id === 'made-by-a'),
                "client A's write never reached client B"
            );
        });

        it("one client's delete becomes visible to the other", async () => {
            server.admin.seed(COLLECTION, [{ id: 'shared', name: 'Shared', price: 1 }]);

            const clientA = connect();
            const clientB = connect();

            await clientA.products.toArrayAsync();
            await clientB.products.toArrayAsync();

            const [row] = await clientA.products.toArrayAsync();
            await clientA.products.removeAsync(row);
            await clientA.saveChangesAsync();

            await readUntil(
                clientB,
                r => r.length === 0,
                "client A's delete never reached client B"
            );
        });
    });

    describe('paginated reads', () => {
        const seedTen = () => {
            server.admin.seed(
                COLLECTION,
                Array.from({ length: 10 }, (_, i) => ({
                    id: `p${String(i).padStart(2, '0')}`,
                    name: `Product ${i}`,
                    price: i,
                }))
            );
        };

        it('sends the window to the server', async () => {
            // The request half is correct, and asserting it separately from the result half
            // is what localises defect #48: the client asks the right question.
            seedTen();

            const client = connect();
            await client.products.sort(p => p.price).skip(3).take(3).toArrayAsync();

            const get = server.requestLog.filter(entry => entry.method === 'GET').at(-1)!;

            expect(get.query.skip).toBe('3');
            expect(get.query.take).toBe('3');
        });

        it('the server answers the window correctly', async () => {
            // And the server half is correct too, so the rows are lost on the client.
            seedTen();

            const client = connect();
            await client.products.sort(p => p.price).skip(3).take(3).toArrayAsync();

            const response = await fetch(`${server.url(COLLECTION)}?sort=price:asc&skip=3&take=3`);
            const rows = await response.json() as { id: string }[];

            expect(rows.map(r => r.id)).toEqual(['p03', 'p04', 'p05']);
        });

        // Pinned: defect #48. The window is applied TWICE — once by the server, which returns
        // the right page, and again when the plugin answers the caller by re-querying its own
        // store with the same event. The store holds only the page just fetched, so `skip(3)`
        // over three rows yields nothing. Any paginated read with skip > 0 returns [].
        it.failing('returns the requested page rather than an empty result', async () => {
            seedTen();

            const client = connect();
            const page = await client.products.sort(p => p.price).skip(3).take(3).toArrayAsync();

            expect(page.map(p => p.id)).toEqual(['p03', 'p04', 'p05']);
        });

        // Pinned: defect #49, which sits behind #48 and cannot be reached until it is fixed.
        // Freshness is per CACHE KEY (query + parameters) but the SWR store is one collection
        // shared by every query. A revalidate computes removes as "rows the store returned for
        // this query that the server did not", and for two different windows those sets
        // describe different slices of the world — so revalidating page one concludes that
        // page two's rows were deleted.
        it.failing('keeps rows from one page when another page is revalidated', async () => {
            seedTen();

            const client = connect();

            const pageTwo = await client.products.sort(p => p.price).skip(3).take(3).toArrayAsync();
            expect(pageTwo.map(p => p.id)).toEqual(['p03', 'p04', 'p05']);

            const pageOne = await client.products.sort(p => p.price).take(3).toArrayAsync();
            expect(pageOne.map(p => p.id)).toEqual(['p00', 'p01', 'p02']);

            await new Promise(resolve => setTimeout(resolve, 150));

            // Nothing was deleted anywhere: the server still holds all ten.
            expect(server.admin.rows(COLLECTION)).toHaveLength(10);

            const stillThere = await client.products.sort(p => p.price).skip(3).take(3).toArrayAsync();

            expect(stillThere.map(p => p.id)).toEqual(['p03', 'p04', 'p05']);
        });

        it('an unwindowed read after a paged read does not lose rows', async () => {
            seedTen();

            const client = connect();

            await client.products.sort(p => p.price).take(3).toArrayAsync();

            const all = await readUntil(
                client,
                r => r.length === 10,
                'a full read after a paged read did not return every row'
            );

            expect(all).toHaveLength(10);
        });
    });
});
