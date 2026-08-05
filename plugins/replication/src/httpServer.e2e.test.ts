import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { MemoryPlugin } from '@routier/memory-plugin';
import { Result } from '@routier/core/results';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { HttpDbPlugin } from './HttpDbPlugin';
import {
    createPersistEvent,
    destroyEvent,
    queryPlugin,
    queueMirrorSchema,
    readQueueRows,
    sleep,
    waitFor,
    waitForRowCount,
} from './__tests__/httpTestKit';

/**
 * Tier 4c — end to end over real HTTP. No fetch mock: an in-process `node:http` server
 * implements the documented wire contract (including opId dedupe) and the plugin talks to
 * it through the platform's own fetch. This is where sockets, real aborts, connection
 * refusals and JSON framing get a say.
 */

const widgetSchema = s
    .define('e2eWidgets', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

type Widget = { id: string; name: string };

interface PostBody {
    adds: Widget[];
    updates: Widget[];
    removes: Widget[];
    meta?: { opIds?: { adds?: string[]; updates?: string[]; removes?: string[] } };
}

/**
 * A server implementing the contract in the handoff: GET returns the collection, POST applies
 * `{ adds, updates, removes }` and dedupes by the opIds in `meta`. State lives on the harness,
 * not the server object, so a restart can bring the same data back on the same port.
 */
class TestServer {
    readonly collections = new Map<string, Map<string, Widget>>();
    readonly seenOpIds = new Set<string>();
    readonly postBodies: PostBody[] = [];
    /** Accept the request and never answer — for exercising client-side timeouts. */
    hang = false;
    port = 0;

    private server: http.Server | null = null;

    async start(port = 0): Promise<void> {
        const server = http.createServer((req, res) => this.handle(req, res));
        this.server = server;

        await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()));
        this.port = (server.address() as AddressInfo).port;
    }

    /** Closes the listener and drops live sockets, so a hung request cannot outlive the test. */
    async stop(): Promise<void> {
        const server = this.server;
        if (server == null) return;
        this.server = null;

        (server as { closeAllConnections?: () => void }).closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    url(collectionName: string): string {
        return `http://127.0.0.1:${this.port}/${collectionName}`;
    }

    rows(collectionName: string): Widget[] {
        return [...(this.collections.get(collectionName)?.values() ?? [])]
            .map((r) => ({ id: r.id, name: r.name }))
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }

    private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (this.hang) {
            return; // socket stays open, no response ever written
        }

        const collectionName = new URL(req.url ?? '/', 'http://127.0.0.1').pathname.slice(1);

        if (req.method === 'GET') {
            this.send(res, 200, this.rows(collectionName));
            return;
        }

        if (req.method !== 'POST') {
            this.send(res, 405, { error: 'method not allowed' });
            return;
        }

        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => { raw += chunk; });
        req.on('end', () => {
            let body: PostBody;
            try {
                body = JSON.parse(raw) as PostBody;
            } catch {
                this.send(res, 400, { error: 'malformed body' });
                return;
            }

            this.postBodies.push(body);
            const saved = this.apply(collectionName, body);
            this.send(res, 200, { saved });
        });
    }

    private apply(collectionName: string, body: PostBody): Widget[] {
        const rows = this.collections.get(collectionName) ?? new Map<string, Widget>();
        this.collections.set(collectionName, rows);
        const opIds = body.meta?.opIds;
        const saved: Widget[] = [];

        const each = (entities: Widget[], keys: string[] | undefined, apply: (row: Widget) => void) => {
            entities.forEach((entity, index) => {
                const opId = keys?.[index];
                if (opId != null && opId !== '') {
                    if (this.seenOpIds.has(opId)) return;
                    this.seenOpIds.add(opId);
                }
                apply(entity);
            });
        };

        // The server is canonical about names: it stamps what it stored, which is what the
        // client reconciles back through translatePersistResponse.
        each(body.adds ?? [], opIds?.adds, (entity) => {
            const stored = { id: entity.id, name: `${entity.name} [server]` };
            rows.set(entity.id, stored);
            saved.push(stored);
        });
        each(body.updates ?? [], opIds?.updates, (entity) => {
            const stored = { id: entity.id, name: `${entity.name} [server]` };
            rows.set(entity.id, stored);
            saved.push(stored);
        });
        each(body.removes ?? [], opIds?.removes, (entity) => {
            rows.delete(entity.id);
        });

        return saved;
    }

    private send(res: http.ServerResponse, status: number, body: unknown): void {
        const payload = JSON.stringify(body);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
        res.end(payload);
    }
}

describe('e2e over node:http', () => {
    let server: TestServer;
    let swrStore: MemoryPlugin;
    let queueStore: MemoryPlugin;
    const plugins: Array<{ destroy: HttpSwrDbPlugin['destroy'] }> = [];

    function createPlugin(options?: Partial<ConstructorParameters<typeof HttpSwrDbPlugin>[1]>) {
        const plugin = new HttpSwrDbPlugin(swrStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collectionName) => server.url(collectionName),
            unsyncedQueueStore: queueStore,
            maxAgeMs: 0,
            bulkPersistRetryMaxAttempts: 1,
            bulkPersistRetryBaseDelayMs: 60_000,
            requestTimeoutMs: 2_000,
            ...options,
        });
        plugins.push(plugin);
        return plugin;
    }

    beforeEach(async () => {
        server = new TestServer();
        await server.start();
        swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
    });

    afterEach(async () => {
        await Promise.all(plugins.splice(0).map((plugin) => new Promise<void>((resolve) => {
            plugin.destroy(destroyEvent(), () => resolve());
        })));
        await server.stop();
    });

    it('persists to the server and reads the round-trip back through a cache miss', async () => {
        const plugin = createPlugin();

        await new Promise<void>((resolve, reject) => {
            plugin.bulkPersist(createPersistEvent({ adds: [{ id: 'w1', name: 'Widget' }] }, widgetSchema), (result) => {
                result.ok === Result.ERROR ? reject(result.error) : resolve();
            });
        });

        await waitFor(() => server.rows('e2eWidgets').length === 1, 'the POST to reach the server');
        expect(server.rows('e2eWidgets')).toEqual([{ id: 'w1', name: 'Widget [server]' }]);
        expect(server.postBodies[0]).toEqual({
            adds: [{ id: 'w1', name: 'Widget' }],
            updates: [],
            removes: [],
            meta: { opIds: { adds: [expect.any(String)], updates: [], removes: [] } },
        });
        await waitForRowCount(queueStore, 0, queueMirrorSchema);

        // A cold client reads the server's copy on its first query
        const coldStore = new MemoryPlugin(`swr-cold-${uuid(8)}`);
        const coldQueue = new MemoryPlugin(`queue-cold-${uuid(8)}`);
        const cold = new HttpSwrDbPlugin(coldStore, {
            // The background loop is off so each test drives syncNow() itself
            autoSync: false,
            getUrl: (collectionName) => server.url(collectionName),
            unsyncedQueueStore: coldQueue,
            bulkPersistRetryBaseDelayMs: 60_000,
        });
        plugins.push(cold);

        const rows = await queryPlugin(cold, widgetSchema);
        expect(rows).toEqual([expect.objectContaining({ id: 'w1', name: 'Widget [server]' })]);
        // ...and the fetched row is durable locally
        expect(await queryPlugin(coldStore, widgetSchema)).toHaveLength(1);
    });

    it('reconciles the server echo over the optimistic copy', async () => {
        const plugin = createPlugin({
            translatePersistResponse: (_schema, body) => (body as { saved?: unknown[] }).saved ?? null,
        });

        await new Promise<void>((resolve, reject) => {
            plugin.bulkPersist(createPersistEvent({ adds: [{ id: 'w2', name: 'Echoed' }] }, widgetSchema), (result) => {
                result.ok === Result.ERROR ? reject(result.error) : resolve();
            });
        });

        await waitFor(async () => {
            const rows = await queryPlugin(swrStore, widgetSchema) as Widget[];
            return rows.length === 1 && rows[0].name === 'Echoed [server]';
        }, "the server's canonical name to replace the optimistic one");
    });

    it('survives a server restart: writes made while it is down arrive afterwards', async () => {
        const plugin = createPlugin();
        const port = server.port;

        await server.stop();

        // Written with nothing listening: the local ack still holds, and the change queues
        await new Promise<void>((resolve, reject) => {
            plugin.bulkPersist(createPersistEvent({ adds: [{ id: 'w3', name: 'Offline' }] }, widgetSchema), (result) => {
                result.ok === Result.ERROR ? reject(result.error) : resolve();
            });
        });
        await sleep(100);

        expect(await queryPlugin(swrStore, widgetSchema)).toHaveLength(1);
        const queued = await readQueueRows(queueStore);
        expect(queued).toHaveLength(1);
        expect(queued[0].status).toBe('pending');

        // Same port, same data — as far as the client is concerned the server was just away
        await server.start(port);
        expect(server.port).toBe(port);

        const outcome = await plugin.syncNow();

        expect(outcome).toEqual({ flushed: 1, failed: 0, deadLettered: 0 });
        expect(server.rows('e2eWidgets')).toEqual([{ id: 'w3', name: 'Offline [server]' }]);
        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('replays are applied once, so a lost ack cannot double-apply a change', async () => {
        const plugin = createPlugin();

        await new Promise<void>((resolve, reject) => {
            plugin.bulkPersist(createPersistEvent({ adds: [{ id: 'w4', name: 'Once' }] }, widgetSchema), (result) => {
                result.ok === Result.ERROR ? reject(result.error) : resolve();
            });
        });
        await waitFor(() => server.rows('e2eWidgets').length === 1, 'the POST to reach the server');

        // Replay the same body the client would resend if that ack had been lost
        const replayed = await fetch(server.url('e2eWidgets'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(server.postBodies[0]),
        });

        expect(replayed.status).toBe(200);
        expect(await replayed.json()).toEqual({ saved: [] });
        expect(server.rows('e2eWidgets')).toEqual([{ id: 'w4', name: 'Once [server]' }]);
    });

    it('a server that accepts the socket but never answers fails on the client timeout', async () => {
        server.hang = true;

        const direct = new HttpDbPlugin({
            getUrl: (collectionName) => server.url(collectionName),
            requestTimeoutMs: 150,
        });

        const started = Date.now();
        await expect(queryPlugin(direct, widgetSchema)).rejects.toThrow('Request timed out after 150ms');
        expect(Date.now() - started).toBeLessThan(3_000);

        // Through the SWR plugin the same timeout degrades to a cache read instead of an error
        const plugin = createPlugin({ requestTimeoutMs: 150 });
        await expect(queryPlugin(plugin, widgetSchema)).resolves.toEqual([]);
    });

    it('a removed row does not come back when the remove is the confirmed change', async () => {
        const plugin = createPlugin();
        const persist = (changes: Parameters<typeof createPersistEvent>[0]) => new Promise<void>((resolve, reject) => {
            plugin.bulkPersist(createPersistEvent(changes, widgetSchema), (result) => {
                result.ok === Result.ERROR ? reject(result.error) : resolve();
            });
        });

        await persist({ adds: [{ id: 'w5', name: 'Doomed' }] });
        await waitFor(() => server.rows('e2eWidgets').length === 1, 'the add to reach the server');
        await waitForRowCount(queueStore, 0, queueMirrorSchema);

        await persist({ removes: [{ id: 'w5', name: 'Doomed [server]' }] });
        await waitFor(() => server.rows('e2eWidgets').length === 0, 'the remove to reach the server');

        // Whatever the queue still holds, replaying it must not resurrect the row
        await plugin.syncNow();
        expect(server.rows('e2eWidgets')).toEqual([]);

        const rows = await queryPlugin(plugin, widgetSchema);
        expect(rows).toEqual([]);
    });
});
