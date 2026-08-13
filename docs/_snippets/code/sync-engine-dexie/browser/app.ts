/**
 * The page. Real IndexedDB, real HTTP, the same stack the Node example builds:
 *
 *   DataStore → PluginSyncEngine → OptimisticUpdatesDbPlugin → DexiePlugin
 *                     └─ mirror → HttpDbPlugin → /api
 */

import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { DexiePlugin } from '@routier/dexie-plugin';
import {
    HttpDbPlugin,
    HttpSwrDbPlugin,
    OptimisticUpdatesDbPlugin,
    PluginSyncEngine,
    type SyncOutcome,
} from '@routier/replication-plugin';

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

const DB_NAME = 'sync-engine-demo';
const QUEUE_DB_NAME = 'sync-engine-demo-queue';
const NAMES = ['Widget', 'Gizmo', 'Doohickey', 'Sprocket', 'Flange', 'Grommet'];

/**
 * The two stacks side by side, because the difference between them is the whole point:
 *
 *  - `engine` — PluginSyncEngine mirrors writes best-effort. A write made while the API is
 *    down is reported through onMirrorError and then forgotten.
 *  - `queue`  — HttpSwrDbPlugin records every write in a durable queue before acking, and
 *    replays it until the server takes it.
 */
type Mode = 'engine' | 'queue';

const log: string[] = [];
let mode: Mode = 'engine';
let store: ProductStore;
/** Set only in queue mode: the object that owns the sync API. */
let swr: HttpSwrDbPlugin | null = null;
let mirrorErrors = 0;
let pending = 0;
let lastSync: SyncOutcome | null = null;
/** postOnPersist: false — defer delivery to the queue flush instead of the short HTTP batch window. */
let coalesceWrites = false;

function note(message: string): void {
    const time = new Date().toISOString().slice(11, 23);
    log.unshift(`${time}  ${message}`);
}

function buildStore(): ProductStore {
    const localDb = new DexiePlugin(DB_NAME);
    const optimisticDb = new OptimisticUpdatesDbPlugin(localDb);

    if (mode === 'queue') {
        swr = new HttpSwrDbPlugin(optimisticDb, {
            getUrl: (collectionName) => `/api/${collectionName}`,
            getHeaders: () => ({ Authorization: 'Bearer demo-token' }),
            // The queue lives in IndexedDB too, so unsynced writes survive a reload
            unsyncedQueueStore: new DexiePlugin(QUEUE_DB_NAME),
            // Automatic replay, tuned tight enough to watch. Omitting `autoSync` gives the same
            // behaviour starting at 1s and backing off to 60s.
            autoSync: { delayMs: 3_000 },
            postOnPersist: !coalesceWrites,
            onSync: (outcome) => {
                lastSync = outcome;
                if (outcome.flushed > 0) note(`auto-sync replayed ${outcome.flushed} change(s)`);
                void refresh();
            },
            onSyncDeadLetter: (changes) => {
                note(`dead-lettered ${changes.length} change(s) — permanently rejected`);
                void refresh();
            },
            bulkPersistRetryMaxAttempts: 1,
        });
        return new ProductStore(swr);
    }

    swr = null;
    const remoteDb = new HttpDbPlugin({
        getUrl: (collectionName) => `/api/${collectionName}`,
        getHeaders: () => ({ Authorization: 'Bearer demo-token' }),
    });

    const plugin = new PluginSyncEngine({
        source: optimisticDb,           // reads and writes land here first
        mirrorPlugins: [remoteDb],      // then get copied to the server
        persistAckMode: 'after-source', // saveChangesAsync resolves on the local write
        onMirrorError: (error) => {
            mirrorErrors++;
            note(`onMirrorError → ${error.message}`);
            void refresh();
        },
    });

    return new ProductStore(plugin);
}

async function switchMode(next: Mode): Promise<void> {
    if (next === mode) return;

    store[Symbol.dispose]();
    mode = next;
    store = buildStore();
    note(`switched to ${next === 'queue' ? 'HttpSwrDbPlugin (durable queue)' : 'PluginSyncEngine (no queue)'}`);
    await refresh();
}

// --- actions ---------------------------------------------------------------

async function syncNow(): Promise<void> {
    if (swr == null) {
        return note('PluginSyncEngine has no queue — there is nothing to replay');
    }

    const outcome = await swr.syncNow();
    lastSync = outcome;
    note(`syncNow → flushed ${outcome.flushed}, failed ${outcome.failed}, dead ${outcome.deadLettered}`);
    await refresh();
}

async function retryDeadLetters(): Promise<void> {
    if (swr == null) {
        return note('only HttpSwrDbPlugin keeps dead letters');
    }

    const { revived, outcome } = await swr.retryDeadLetters();
    note(revived === 0 ? 'no dead letters to retry' : `revived ${revived}, flushed ${outcome.flushed}`);
    await refresh();
}

async function addProduct(): Promise<void> {
    const existing = await store.products.toArrayAsync();
    const name = NAMES[existing.length % NAMES.length] + (existing.length >= NAMES.length ? ` ${existing.length}` : '');
    const price = Math.round((5 + Math.random() * 40) * 100) / 100;

    const started = performance.now();
    await store.products.addAsync({ name, price } as never);
    await store.saveChangesAsync();
    note(`add "${name}" — saveChangesAsync resolved in ${(performance.now() - started).toFixed(1)}ms`);

    await refreshSoon();
}

async function bumpPrice(): Promise<void> {
    const rows = await store.products.toArrayAsync();
    if (rows.length === 0) return note('nothing to update');

    const target = await store.products.firstAsync((p) => p._id === rows[0]._id);
    target.price = Math.round((target.price + 1) * 100) / 100;
    await store.saveChangesAsync();
    note(`update "${target.name}" → ${target.price}`);

    await refreshSoon();
}

async function removeLast(): Promise<void> {
    const rows = await store.products.toArrayAsync();
    if (rows.length === 0) return note('nothing to remove');

    const last = rows[rows.length - 1];
    await store.products.removeAsync(last as never);
    await store.saveChangesAsync();
    note(`remove "${last.name}"`);

    await refreshSoon();
}

async function readLocally(): Promise<void> {
    const before = (await serverState()).requestLog.length;
    const rows = await store.products.toArrayAsync();
    const expensive = await store.products.where((p) => p.price > 20).toArrayAsync();
    const after = (await serverState()).requestLog.length;

    note(`read ${rows.length} row(s), ${expensive.length} over 20 — network requests: ${after - before}`);
    await refresh();
}

async function reloadStore(): Promise<void> {
    // Symbol.dispose releases the store; destroyAsync would DELETE the Dexie database
    store[Symbol.dispose]();
    store = buildStore();
    const rows = await store.products.toArrayAsync();
    note(`reloaded from IndexedDB → ${rows.length} row(s) still there`);

    await refresh();
}

async function toggleCoalesce(): Promise<void> {
    coalesceWrites = !coalesceWrites;
    note(`writes are now ${coalesceWrites ? 'deferred to the queue flush' : 'sent through the short HTTP batch window'}`);

    if (mode === 'queue') {
        store[Symbol.dispose]();
        store = buildStore();
    }

    await refresh();
}

/** Ten saves as fast as the store will take them — the burst write batching exists for. */
async function burstWrites(): Promise<void> {
    const before = (await serverState()).requestLog.filter((l) => l.startsWith('POST')).length;
    const started = performance.now();

    for (let i = 0; i < 10; i++) {
        await store.products.addAsync({ name: `Burst ${i}`, price: 1 + i } as never);
        await store.saveChangesAsync();
    }

    note(`10 saves in ${(performance.now() - started).toFixed(0)}ms`);
    await refresh();

    // Give the paced flush time to deliver, then report what it actually cost
    setTimeout(() => {
        void (async () => {
            const after = (await serverState()).requestLog.filter((l) => l.startsWith('POST')).length;
            note(`10 writes cost ${after - before} POST(s)`);
            await refresh();
        })();
    }, 5_000);
}

async function toggleReject(): Promise<void> {
    const { rejectWrites } = await fetch('/_reject').then((r) => r.json());
    note(`server now ${rejectWrites ? 'rejects writes with 422 (permanent)' : 'accepts writes'}`);
    await refresh();
}

async function toggleServer(): Promise<void> {
    const { serverDown } = await fetch('/_toggle').then((r) => r.json());
    note(`API is now ${serverDown ? 'DOWN' : 'UP'}`);
    await refresh();
}

async function resetAll(): Promise<void> {
    await fetch('/_reset');
    store[Symbol.dispose]();
    await new Promise<void>((resolve) => indexedDB.deleteDatabase(DB_NAME).onsuccess = () => resolve());
    store = buildStore();
    log.length = 0;
    mirrorErrors = 0;
    note('reset: IndexedDB deleted, server cleared');
    await refresh();
}

// --- rendering -------------------------------------------------------------

interface ServerState {
    rows: Array<{ _id: string; name: string; price: number }>;
    requestLog: string[];
    serverDown: boolean;
    rejectWrites: boolean;
}

function serverState(): Promise<ServerState> {
    return fetch('/_state').then((r) => r.json());
}

function table(rows: Array<{ _id: string; name: string; price: number }>): string {
    if (rows.length === 0) return '<p class="empty">no rows</p>';
    return `<table><thead><tr><th>name</th><th>price</th><th>_id</th></tr></thead><tbody>${rows
        .map((r) => `<tr><td>${r.name}</td><td>${r.price.toFixed(2)}</td><td class="id">${r._id.slice(0, 8)}…</td></tr>`)
        .join('')}</tbody></table>`;
}

/**
 * Refreshes now, and again once the POST that follows the ack has had time to land. The ack
 * deliberately does not wait for the network, so a single refresh always shows a stale
 * "pending" count.
 */
async function refreshSoon(): Promise<void> {
    await refresh();
    setTimeout(() => { void refresh(); }, 250);
}

async function refresh(): Promise<void> {
    const local = await store.products.toArrayAsync();
    const server = await serverState();
    pending = swr != null ? await swr.pendingCount() : 0;
    const dead = swr != null ? (await swr.deadLetters()).length : 0;

    document.getElementById('mode')!.textContent = mode === 'queue'
        ? 'HttpSwrDbPlugin — durable queue, replays until accepted'
        : 'PluginSyncEngine — best-effort mirror, no replay';
    (document.getElementById('mode-engine') as HTMLButtonElement).disabled = mode === 'engine';
    (document.getElementById('mode-queue') as HTMLButtonElement).disabled = mode === 'queue';

    const queueBadge = document.getElementById('queue-badge')!;
    queueBadge.textContent = swr == null ? 'no queue' : `${pending} pending, ${dead} dead`;
    queueBadge.className = swr == null ? 'tag' : pending === 0 && dead === 0 ? 'tag ok' : 'tag warn';
    const moved = lastSync != null && (lastSync.flushed > 0 || lastSync.failed > 0 || lastSync.deadLettered > 0);
    document.getElementById('last-sync')!.textContent = lastSync == null
        ? '—'
        : moved
            ? `flushed ${lastSync.flushed}, failed ${lastSync.failed}, dead ${lastSync.deadLettered}`
            : 'nothing to send';
    (document.getElementById('reject') as HTMLButtonElement).textContent =
        server.rejectWrites ? 'Accept writes again' : 'Reject writes (422)';
    const coalesceButton = document.getElementById('coalesce') as HTMLButtonElement;
    coalesceButton.textContent = coalesceWrites ? 'Writes: deferred queue flush' : 'Writes: immediate 25 ms batch';
    coalesceButton.disabled = mode !== 'queue';

    document.getElementById('status')!.className = server.serverDown ? 'status down' : 'status up';
    document.getElementById('status')!.textContent = server.serverDown ? 'API: DOWN' : 'API: UP';
    (document.getElementById('toggle') as HTMLButtonElement).textContent =
        server.serverDown ? 'Bring the API back' : 'Take the API down';

    document.getElementById('local')!.innerHTML = table(local as never);
    document.getElementById('server')!.innerHTML = table(server.rows);
    document.getElementById('mirror-errors')!.textContent = String(mirrorErrors);
    document.getElementById('drift')!.textContent = local.length === server.rows.length
        ? 'in sync'
        : `${Math.abs(local.length - server.rows.length)} row(s) only local`;
    document.getElementById('drift')!.className = local.length === server.rows.length ? 'tag ok' : 'tag warn';

    document.getElementById('log')!.textContent = log.slice(0, 14).join('\n');
    document.getElementById('requests')!.textContent = server.requestLog.slice(-14).reverse().join('\n');
}

async function main(): Promise<void> {
    store = buildStore();

    const bind = (id: string, handler: () => Promise<void>) => {
        document.getElementById(id)!.addEventListener('click', () => {
            handler().catch((err) => { note(`ERROR ${String(err)}`); void refresh(); });
        });
    };

    bind('add', addProduct);
    bind('bump', bumpPrice);
    bind('remove', removeLast);
    bind('read', readLocally);
    bind('reload', reloadStore);
    bind('toggle', toggleServer);
    bind('reset', resetAll);
    bind('sync', syncNow);
    bind('retry-dead', retryDeadLetters);
    bind('mode-engine', () => switchMode('engine'));
    bind('mode-queue', () => switchMode('queue'));
    bind('reject', toggleReject);
    bind('burst', burstWrites);
    bind('coalesce', toggleCoalesce);

    note('ready — local store is Dexie over the browser\'s IndexedDB');
    await refresh();
}

void main();
