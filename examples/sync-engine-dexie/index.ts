/**
 * Runnable example: PluginSyncEngine over Dexie, mirroring to a real HTTP server.
 *
 *   npx tsx examples/sync-engine-dexie/index.ts
 *
 * It starts an actual `node:http` server implementing Routier's replication wire contract,
 * builds the stack a browser app would use, and prints what each layer really did:
 *
 *   DataStore
 *     └─ PluginSyncEngine        source = local, mirrors = the API
 *          ├─ OptimisticUpdatesDbPlugin   in-memory read cache
 *          │    └─ DexiePlugin            durable local storage (IndexedDB)
 *          └─ HttpDbPlugin                the server
 *
 * Node has no IndexedDB, so `fake-indexeddb/auto` stands in for the browser's. It is a real
 * IndexedDB implementation — Dexie does not know the difference — which is also how the
 * Dexie plugin's own test suite runs.
 */

import 'fake-indexeddb/auto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { DexiePlugin } from '@routier/dexie-plugin';
import { HttpDbPlugin, OptimisticUpdatesDbPlugin, PluginSyncEngine } from '@routier/replication-plugin';

const productSchema = s
    .define('products', {
        _id: s.string().key().identity(),
        name: s.string(),
        price: s.number(),
    })
    .compile();

class ProductStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

type Product = { _id: string; name: string; price: number };

// ---------------------------------------------------------------------------
// The server: per-collection rows, plus the additive `meta.opIds` dedupe block
// ---------------------------------------------------------------------------

interface PostBody {
    adds?: Product[];
    updates?: Product[];
    removes?: Product[];
    meta?: { opIds?: { adds?: string[]; updates?: string[]; removes?: string[] } };
}

class ApiServer {
    readonly rows = new Map<string, Product>();
    readonly log: string[] = [];
    private server: http.Server | null = null;
    port = 0;

    async start(port = 0): Promise<void> {
        const server = http.createServer((req, res) => this.handle(req, res));
        this.server = server;
        await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()));
        this.port = (server.address() as AddressInfo).port;
        this.log.push(`server listening on ${this.port}`);
    }

    async stop(): Promise<void> {
        const server = this.server;
        if (server == null) return;
        this.server = null;
        (server as { closeAllConnections?: () => void }).closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        this.log.push('server stopped');
    }

    url(collectionName: string): string {
        return `http://127.0.0.1:${this.port}/${collectionName}`;
    }

    snapshot(): Product[] {
        return [...this.rows.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.method === 'GET') {
            this.log.push(`GET  ${req.url}`);
            this.send(res, 200, this.snapshot());
            return;
        }

        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => { raw += chunk; });
        req.on('end', () => {
            const body = JSON.parse(raw) as PostBody;
            const summary = [
                body.adds?.length ? `+${body.adds.length}` : null,
                body.updates?.length ? `~${body.updates.length}` : null,
                body.removes?.length ? `-${body.removes.length}` : null,
            ].filter(Boolean).join(' ');
            this.log.push(`POST ${req.url} ${summary}  ids=${JSON.stringify(idsOf(body))}`);

            for (const entity of body.adds ?? []) this.rows.set(entity._id, entity);
            for (const entity of body.updates ?? []) this.rows.set(entity._id, entity);
            for (const entity of body.removes ?? []) this.rows.delete(entity._id);

            this.send(res, 200, { saved: [...(body.adds ?? []), ...(body.updates ?? [])] });
        });
    }

    private send(res: http.ServerResponse, status: number, body: unknown): void {
        const payload = JSON.stringify(body);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
        res.end(payload);
    }
}

function idsOf(body: PostBody): unknown[] {
    return [...(body.adds ?? []), ...(body.updates ?? []), ...(body.removes ?? [])].map((e) => e._id);
}

// ---------------------------------------------------------------------------
// The example
// ---------------------------------------------------------------------------

const DEXIE_DB_NAME = `sync-engine-example-${Date.now()}`;

function buildStore(server: ApiServer, mirrorErrors: Error[]) {
    const localDb = new DexiePlugin(DEXIE_DB_NAME);
    const optimisticDb = new OptimisticUpdatesDbPlugin(localDb);
    const remoteDb = new HttpDbPlugin({
        getUrl: (collectionName) => server.url(collectionName),
        getHeaders: () => ({ Authorization: 'Bearer example-token' }),
    });

    const plugin = new PluginSyncEngine({
        source: optimisticDb,           // reads and writes land here first
        mirrorPlugins: [remoteDb],      // then get copied to the server
        persistAckMode: 'after-source', // saveChangesAsync resolves on the local write
        onMirrorError: (error) => { mirrorErrors.push(error); },
        // No `mirrorPersistPayloadMode` here on purpose. It was the first thing that looked
        // necessary — identity keys are assigned locally, so surely the mirror needs the
        // resolved entities? Running it both ways says otherwise: the ids reach the server
        // either way, because the change tracker fills them in on the very objects the event
        // carries. The option earns its keep when a source plugin answers with *different*
        // entities than the ones sent to it (a SQL backend returning generated keys), which
        // is not this stack.
    });

    return new ProductStore(plugin);
}

function heading(text: string): void {
    console.log(`\n${'─'.repeat(72)}\n${text}\n${'─'.repeat(72)}`);
}

async function main(): Promise<void> {
    const server = new ApiServer();
    await server.start();
    const mirrorErrors: Error[] = [];
    let store = buildStore(server, mirrorErrors);

    heading('1. Write locally, mirror to the server');

    const started = Date.now();
    const [widget, gizmo] = await store.products.addAsync(
        { name: 'Widget', price: 9.99 } as never,
        { name: 'Gizmo', price: 24.5 } as never,
    );
    await store.saveChangesAsync();
    console.log(`saveChangesAsync resolved in ${Date.now() - started}ms`);
    console.log('ids assigned locally:', [widget._id, gizmo._id]);

    // The ack came from the local write; the mirror is still in flight
    await settle();
    console.log('server rows:', server.snapshot());

    heading('2. Reads are served locally — the network is not touched');

    const getsBefore = server.log.filter((l) => l.startsWith('GET')).length;
    const all = await store.products.toArrayAsync();
    const dear = await store.products.where((p) => p.price > 10).toArrayAsync();
    console.log('all products:', all.map((p) => p.name));
    console.log('price > 10  :', dear.map((p) => p.name));
    console.log('GET requests issued by those reads:', server.log.filter((l) => l.startsWith('GET')).length - getsBefore);

    heading('3. Update and remove propagate to the server');

    const found = await store.products.firstAsync((p) => p.name === 'Widget');
    found.price = 12.75;
    await store.products.removeAsync(gizmo as never);
    await store.saveChangesAsync();
    await settle();
    console.log('server rows:', server.snapshot());

    heading('4. The server goes away');

    await server.stop();
    const offlineStarted = Date.now();
    await store.products.addAsync({ name: 'Offline Item', price: 5 } as never);
    await store.saveChangesAsync();
    console.log(`saveChangesAsync still resolved in ${Date.now() - offlineStarted}ms (local write succeeded)`);
    await settle();
    console.log('local rows now  :', (await store.products.toArrayAsync()).map((p) => p.name));
    console.log('onMirrorError calls:', mirrorErrors.length, mirrorErrors.map((e) => e.message.slice(0, 60)));

    heading('5. Server comes back — is the offline write sent?');

    await server.start();
    await settle(300);
    console.log('server rows:', server.snapshot());
    console.log('^ PluginSyncEngine does not retry a failed mirror. HttpSwrDbPlugin is the');
    console.log('  layer that adds the durable queue and replays it.');

    heading('6. Reload: a fresh store over the same Dexie database');

    // `[Symbol.dispose]` releases this store; `destroyAsync` would DELETE the Dexie database
    // (DexiePlugin.destroy calls db.delete()), which is teardown, not a page reload.
    store[Symbol.dispose]();
    store = buildStore(server, mirrorErrors);
    const reloaded = await store.products.toArrayAsync();
    console.log('rows read back from IndexedDB:', reloaded.map((p) => `${p.name} (${p.price})`));

    heading('Server request log');
    server.log.forEach((line) => console.log(' ', line));

    // Now the real teardown: this drops the example's IndexedDB database
    await store.destroyAsync().catch(() => undefined);
    await server.stop();
}

/** Lets the background mirror finish; it is deliberately not awaited by saveChangesAsync. */
function settle(ms = 150): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().then(
    () => { console.log('\ndone\n'); process.exit(0); },
    (err) => { console.error('\nexample failed:', err); process.exit(1); }
);
