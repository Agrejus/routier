import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from '@routier/replication-plugin';

/**
 * The replication wire format, verified end to end: a real `DataStore` mutation, through the
 * change tracker's delta, the plugin's trim, and a real HTTP request on a real socket.
 *
 * This lives in `e2e/` rather than beside the plugin because it spans three packages —
 * `plugins/replication`'s own tsconfig has no `paths`, so `@routier/datastore`'s types resolve
 * to a stale copy there and `.proxy()` does not typecheck.
 *
 * What it protects: an update should carry the key fields and the fields that changed. Sending
 * whole rows means a one-field edit ships every column — wasteful, and it silently overwrites
 * concurrent changes to fields this client never touched.
 */

const widgetSchema = s
    .define('wireWidgets', {
        _id: s.string().key().identity(),
        name: s.string(),
        price: s.number(),
        note: s.string().optional(),
    })
    .compile();

class WidgetStore extends DataStore {
    widgets = this.collection(widgetSchema).proxy().create();
}

interface PostBody {
    adds: Array<Record<string, unknown>>;
    updates: Array<Record<string, unknown>>;
    removes: Array<Record<string, unknown>>;
}

describe('replication update wire format', () => {
    let server: http.Server;
    let port: number;
    let bodies: PostBody[];
    let store: WidgetStore | null;

    beforeEach(async () => {
        bodies = [];
        store = null;

        server = http.createServer((req, res) => {
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('[]');
                return;
            }

            let raw = '';
            req.setEncoding('utf8');
            req.on('data', (chunk: string) => { raw += chunk; });
            req.on('end', () => {
                bodies.push(JSON.parse(raw) as PostBody);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{}');
            });
        });

        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        port = (server.address() as AddressInfo).port;
    });

    afterEach(async () => {
        store?.[Symbol.dispose]();
        (server as { closeAllConnections?: () => void }).closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    function createStore() {
        const plugin = new HttpSwrDbPlugin(new MemoryPlugin(`swr-${port}`), {
            getUrl: (collectionName) => `http://127.0.0.1:${port}/${collectionName}`,
            unsyncedQueueStore: new MemoryPlugin(`queue-${port}`),
            autoSync: false,
            bulkPersistRetryMaxAttempts: 1,
        });
        store = new WidgetStore(plugin);
        return store;
    }

    /** Waits for the POST the plugin issues after the ack, which is deliberately not awaited. */
    async function waitForBodies(count: number): Promise<void> {
        const deadline = Date.now() + 4000;
        while (bodies.length < count) {
            if (Date.now() > deadline) throw new Error(`only ${bodies.length} of ${count} POST(s) arrived`);
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }

    it('sends the whole entity for an add', async () => {
        const widgets = createStore();

        await widgets.widgets.addAsync({ name: 'Widget', price: 10, note: 'first' } as never);
        await widgets.saveChangesAsync();
        await waitForBodies(1);

        expect(bodies[0].adds).toHaveLength(1);
        expect(Object.keys(bodies[0].adds[0]).sort()).toEqual(['_id', 'name', 'note', 'price']);
    });

    it('sends only the key and the changed field for an update', async () => {
        const widgets = createStore();

        await widgets.widgets.addAsync({ name: 'Widget', price: 10, note: 'first' } as never);
        await widgets.saveChangesAsync();
        await waitForBodies(1);

        const found = await widgets.widgets.firstAsync((w) => w.name === 'Widget');
        found.price = 99;
        await widgets.saveChangesAsync();
        await waitForBodies(2);

        const [sent] = bodies[1].updates;
        expect(bodies[1].updates).toHaveLength(1);
        expect(Object.keys(sent).sort()).toEqual(['_id', 'price']);
        expect(sent.price).toBe(99);
        // `name` and `note` did not change, so the server is not told anything about them
        expect(sent.name).toBeUndefined();
        expect(sent.note).toBeUndefined();
    });

    it('sends every field that changed, and only those', async () => {
        const widgets = createStore();

        await widgets.widgets.addAsync({ name: 'Widget', price: 10, note: 'first' } as never);
        await widgets.saveChangesAsync();
        await waitForBodies(1);

        const found = await widgets.widgets.firstAsync((w) => w.name === 'Widget');
        found.name = 'Renamed';
        found.note = 'second';
        await widgets.saveChangesAsync();
        await waitForBodies(2);

        const [sent] = bodies[1].updates;
        expect(Object.keys(sent).sort()).toEqual(['_id', 'name', 'note']);
        expect(sent).toEqual(expect.objectContaining({ name: 'Renamed', note: 'second' }));
        expect(sent.price).toBeUndefined();
    });

    it('sends the whole entity for a remove', async () => {
        const widgets = createStore();

        const [added] = await widgets.widgets.addAsync({ name: 'Widget', price: 10 } as never);
        await widgets.saveChangesAsync();
        await waitForBodies(1);

        await widgets.widgets.removeAsync(added);
        await widgets.saveChangesAsync();
        await waitForBodies(2);

        expect(bodies[1].removes).toHaveLength(1);
        expect(bodies[1].removes[0]._id).toBe(added._id);
    });
});
