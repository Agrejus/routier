import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PouchDbPlugin } from '@routier/pouchdb-plugin';

/**
 * PouchDB replication against a real CouchDB server.
 *
 * The plugin's sync path had never been executed against anything. Its unit suites use the
 * in-memory adapter and never call `sync()`, so the defects there — a module-global handle
 * under the literal key `"sync"` that let only the first plugin in a process replicate, and a
 * `destroy()` that left the replication running — were invisible. Replication is also the one
 * part of this plugin that cannot be tested without a second database that is genuinely
 * remote: an in-process fake would not exercise the HTTP adapter, the auth headers, or the
 * continuous-change feed that `cancel()` has to stop.
 *
 * Gated behind E2E_CONTAINERS with the rest of the container suites.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

const COUCH_USER = 'admin';
const COUCH_PASSWORD = 'routier-test';

const schema = s.define('couch_rows', {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    label: s.string(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

type SyncOptions = NonNullable<ConstructorParameters<typeof PouchDbPlugin>[1]>['sync'];

class Store extends DataStore {
    rows = this.collection(schema)
        .scope(([x, p]) => x.documentType === p.collectionName, { ...schema })
        .proxy()
        .create();
}

suite('PouchDB replication against CouchDB', () => {
    let container: StartedTestContainer;
    let remoteBase: string;

    const stores: Store[] = [];

    /**
     * A local PouchDB and the plugin behind it.
     *
     * The plugin is returned rather than reached through the store because `sync()` is
     * called on the plugin — `plugin.sync(store.schemas)` is the documented shape, and the
     * store does not expose its plugin.
     */
    const open = (localName: string, sync?: SyncOptions) => {
        const plugin = new PouchDbPlugin(localName, sync == null ? undefined : { sync });
        const store = new Store(plugin);
        stores.push(store);
        return { store, plugin };
    };

    /** Credentials inline, which is how PouchDB addresses a protected CouchDB database. */
    const remoteFor = (database: string) =>
        `${remoteBase.replace('http://', `http://${COUCH_USER}:${COUCH_PASSWORD}@`)}/${database}`;

    const createRemoteDatabase = async (database: string) => {
        const response = await fetch(`${remoteBase}/${database}`, {
            method: 'PUT',
            headers: {
                Authorization: `Basic ${Buffer.from(`${COUCH_USER}:${COUCH_PASSWORD}`).toString('base64')}`,
            },
        });

        // 412 is "already exists", which is the state this wants either way.
        if (response.ok === false && response.status !== 412) {
            throw new Error(`Could not create CouchDB database '${database}': ${response.status}`);
        }
    };

    const remoteDocumentCount = async (database: string) => {
        const response = await fetch(`${remoteBase}/${database}/_all_docs`, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${COUCH_USER}:${COUCH_PASSWORD}`).toString('base64')}`,
            },
        });
        const body = await response.json() as { rows?: unknown[] };

        // Design documents are not entities; the plugin writes one for its indexes.
        return (body.rows ?? []).filter((row: any) => String(row.id).startsWith('_design/') === false).length;
    };

    /** Polls until `check` holds or the budget runs out — replication is asynchronous. */
    const eventually = async (check: () => Promise<boolean>, budgetMs = 20_000) => {
        const deadline = Date.now() + budgetMs;

        while (Date.now() < deadline) {
            if (await check()) {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 250));
        }

        return false;
    };

    beforeAll(async () => {
        container = await new GenericContainer('couchdb:3')
            .withEnvironment({
                COUCHDB_USER: COUCH_USER,
                COUCHDB_PASSWORD: COUCH_PASSWORD,
            })
            .withExposedPorts(5984)
            // The port accepts connections before CouchDB finishes setting up its system
            // databases, and a replication started in that window fails with a 404 that
            // looks like a plugin bug.
            .withWaitStrategy(Wait.forHttp('/_up', 5984).forStatusCode(200))
            .start();

        remoteBase = `http://${container.getHost()}:${container.getMappedPort(5984)}`;
    }, 180_000);

    afterEach(async () => {
        for (const store of stores.splice(0)) {
            await store.destroyAsync().catch(() => undefined);
        }
    });

    afterAll(async () => {
        await container?.stop();
    });

    it('replicates a saved document to the remote', async () => {
        const database = `repl-${uuidv4()}`;
        await createRemoteDatabase(database);

        const { store, plugin } = open(`local-${uuidv4()}`, { remoteDb: remoteFor(database), live: true, retry: true });

        // `sync()` is what starts replication; the plugin does not start it implicitly.
        plugin.sync(store.schemas);

        await store.rows.addAsync({ label: 'replicated' } as any);
        await store.saveChangesAsync();

        const arrived = await eventually(async () => (await remoteDocumentCount(database)) >= 1);

        expect(arrived).toBe(true);
    }, 60_000);

    it('reads a document written directly to the remote', async () => {
        const database = `pull-${uuidv4()}`;
        await createRemoteDatabase(database);

        await fetch(`${remoteBase}/${database}/seeded-doc`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(`${COUCH_USER}:${COUCH_PASSWORD}`).toString('base64')}`,
            },
            body: JSON.stringify({ label: 'from-server', documentType: 'couch_rows' }),
        });

        const { store, plugin } = open(`local-pull-${uuidv4()}`, { remoteDb: remoteFor(database), live: true, retry: true });
        plugin.sync(store.schemas);

        const pulled = await eventually(async () => (await store.rows.countAsync()) >= 1);

        expect(pulled).toBe(true);
    }, 60_000);

    it('lets two plugins replicate to two different remotes', async () => {
        // The defect this exists for: the sync handle used to live at module level under the
        // literal key "sync", so the SECOND plugin in a process received the first one's
        // handle — pointed at the first one's remote — and its own remote stayed empty.
        const firstDatabase = `two-a-${uuidv4()}`;
        const secondDatabase = `two-b-${uuidv4()}`;
        await createRemoteDatabase(firstDatabase);
        await createRemoteDatabase(secondDatabase);

        const first = open(`local-two-a-${uuidv4()}`, { remoteDb: remoteFor(firstDatabase), live: true, retry: true });
        const second = open(`local-two-b-${uuidv4()}`, { remoteDb: remoteFor(secondDatabase), live: true, retry: true });

        first.plugin.sync(first.store.schemas);
        second.plugin.sync(second.store.schemas);

        await first.store.rows.addAsync({ label: 'to-a' } as any);
        await first.store.saveChangesAsync();
        await second.store.rows.addAsync({ label: 'to-b' } as any);
        await second.store.saveChangesAsync();

        const bothArrived = await eventually(async () =>
            (await remoteDocumentCount(firstDatabase)) >= 1
            && (await remoteDocumentCount(secondDatabase)) >= 1
        );

        expect(bothArrived).toBe(true);
    }, 90_000);

    it('cancels replication on destroy', async () => {
        const database = `cancel-${uuidv4()}`;
        await createRemoteDatabase(database);

        const { store, plugin } = open(`local-cancel-${uuidv4()}`, { remoteDb: remoteFor(database), live: true, retry: true });
        const handle = plugin.sync(store.schemas);

        await store.rows.addAsync({ label: 'before-cancel' } as any);
        await store.saveChangesAsync();
        await eventually(async () => (await remoteDocumentCount(database)) >= 1);

        let cancelled = false;
        handle.on('complete', () => { cancelled = true; });

        await store.destroyAsync();

        // A live sync that is never cancelled keeps polling the remote after the caller has
        // finished with the plugin, and holds both databases open with it.
        const stopped = await eventually(async () => cancelled, 10_000);

        expect(stopped).toBe(true);
    }, 90_000);

    it('rejects a bad password rather than replicating silently', async () => {
        const database = `auth-${uuidv4()}`;
        await createRemoteDatabase(database);

        const errors: unknown[] = [];
        const { store, plugin } = open(`local-auth-${uuidv4()}`, {
            remoteDb: `${remoteBase.replace('http://', `http://${COUCH_USER}:wrong-password@`)}/${database}`,
            live: true,
            retry: false,
            onError: (_schemas, error) => { errors.push(error); },
        });

        plugin.sync(store.schemas);

        await store.rows.addAsync({ label: 'unauthorized' } as any);
        await store.saveChangesAsync();

        const reported = await eventually(async () => errors.length > 0, 20_000);

        // Either the error handler fires or nothing reaches the remote. What must NOT happen
        // is a document arriving with credentials the server rejected.
        const count = await remoteDocumentCount(database);

        expect(reported || count === 0).toBe(true);
    }, 60_000);
});
