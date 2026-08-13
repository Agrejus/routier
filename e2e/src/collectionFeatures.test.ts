import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CacheDbPlugin, RetryDbPlugin } from '@routier/core/plugins';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';

/**
 * A small application using every collection feature at once, against real databases.
 *
 * Each feature has its own tests and each passes alone. What none of them cover is the thing
 * an application actually does: turn them all on together. The interactions are where the
 * surprises live, and three of them are asserted below because they are decisions rather than
 * accidents:
 *
 *  - Soft delete rewrites a removal into an update BEFORE auditing sees the save, so the
 *    trail records an update carrying the deletion stamp. There is no `remove` entry, and
 *    that is correct — nothing was removed.
 *  - The cache sits in front of a collection whose reads are scoped, so its keys have to
 *    distinguish the scoped read from an unscoped one, or a soft-deleted row stays visible.
 *  - Audit rows are written by the store, not by a collection, and the cache must not go on
 *    serving a history that predates them.
 *
 * SQLite runs unconditionally against a real file. PostgreSQL runs behind E2E_CONTAINERS,
 * because the same composition over a client/server engine with real DDL is where a
 * disagreement between them would show.
 */

const productSchema = s.define('e2e_feature_products', {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    deletedAt: s.date().nullable(),
}).compile();

const historySchema = s.define('e2e_feature_history', {
    id: s.string().key().identity(),
    collection: s.string(),
    operation: s.string(),
    changed: s.string(),
    at: s.date().deserialize(x => new Date(x as string)),
}).compile();

/** The application: audited, soft-deleting, behind a cache and a retry. */
class ShopStore extends DataStore {
    history = this.collection(historySchema).proxy().create();

    products = this.collection(productSchema)
        .softDelete(x => x.deletedAt)
        .audit(historySchema)
        .derive((changes, cb) => {
            cb(changes.map(change => ({
                collection: change.collection,
                operation: change.operation,
                changed: JSON.stringify(change.delta ?? {}),
                at: change.at,
            })));
        })
        .proxy()
        .create();
}

/** The same tables with nothing declared — how deleted rows are read back. */
class RawStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

type Subject = {
    readonly name: string;
    /** A plugin over the same database each time it is called. */
    readonly plugin: () => IDbPlugin;
};

const subjects: Subject[] = [];
const files: string[] = [];
let container: StartedPostgreSqlContainer | undefined;

const shouldRunContainers = process.env.E2E_CONTAINERS === '1';

beforeAll(async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'routier-features-')), `${uuidv4()}.sqlite`);
    files.push(file);

    subjects.push({
        name: 'SQLite',
        // Wrapped exactly as an application would: retry outermost, then the cache, then the
        // backend. Order matters — a cache inside a retry would be re-read on every attempt.
        plugin: () => new RetryDbPlugin(new CacheDbPlugin(new SqliteDbPlugin(file))),
    });

    if (shouldRunContainers) {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();

        const config = {
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        };

        subjects.push({
            name: 'PostgreSQL',
            plugin: () => new RetryDbPlugin(new CacheDbPlugin(new PostgresDbPlugin(config))),
        });
    }
}, 180_000);

afterAll(async () => {
    await container?.stop();

    for (const file of files) {
        fs.rmSync(path.dirname(file), { recursive: true, force: true });
    }
});

const opened: DataStore[] = [];

afterEach(async () => {
    for (const store of opened.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('a store using every collection feature', () => {

    // Registered per subject at run time, because the PostgreSQL subject only exists once the
    // container has started.
    const forEachSubject = (name: string, body: (subject: Subject) => Promise<void>) => {
        it(name, async () => {
            for (const subject of subjects) {
                await body(subject);
            }
        }, 60_000);
    };

    it('runs against every subject the environment allows', () => {
        // Without this the suite passes just as happily when the container never started and
        // only SQLite ran — the loop would simply have one fewer subject and nothing would
        // say so. Every case below is a for-loop over a list, which is exactly the shape that
        // hides an empty list.
        expect(subjects.map(x => x.name)).toEqual(
            shouldRunContainers ? ['SQLite', 'PostgreSQL'] : ['SQLite']
        );
    });

    const open = (subject: Subject) => {
        const store = new ShopStore(subject.plugin());
        opened.push(store);
        return store;
    };

    const openRaw = (subject: Subject) => {
        const store = new RawStore(subject.plugin());
        opened.push(store);
        return store;
    };

    /** A fresh, empty pair of tables for one case. */
    const clean = async (subject: Subject) => {
        const raw = openRaw(subject);
        const existing = await raw.products.toArrayAsync();

        if (existing.length > 0) {
            await raw.products.removeAsync(...existing);
            await raw.saveChangesAsync();
        }

        const store = open(subject);
        const history = await store.history.toArrayAsync();

        if (history.length > 0) {
            await store.history.removeAsync(...history);
            await store.saveChangesAsync();
        }

        return { store, raw };
    };

    forEachSubject('records an add in the audit trail', async subject => {
        const { store } = await clean(subject);

        await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        await store.saveChangesAsync();

        const trail = await store.history.toArrayAsync();

        expect(trail.map(h => h.operation)).toEqual(['add']);
        expect(trail[0].collection).toBe('e2e_feature_products');
    });

    forEachSubject('audits a soft delete as an update, not a remove', async subject => {
        const { store } = await clean(subject);

        const [product] = await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        const trail = await store.history.toArrayAsync();
        const removal = trail.filter(h => h.operation !== 'add');

        // Soft delete rewrites the removal before auditing sees the save. Recording it as a
        // `remove` would say the row is gone, and it is not — it is still there, stamped.
        expect(removal.map(h => h.operation)).toEqual(['update']);
        expect(JSON.parse(removal[0].changed)).toHaveProperty('deletedAt');
    });

    forEachSubject('hides a soft-deleted row while leaving it in the table', async subject => {
        const { store, raw } = await clean(subject);

        const [product] = await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        expect(await store.products.countAsync()).toBe(0);
        expect(await raw.products.countAsync()).toBe(1);
    });

    forEachSubject('does not serve a cached read after a soft delete', async subject => {
        const { store } = await clean(subject);

        const [product] = await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        await store.saveChangesAsync();

        // Warm the cache with the row visible.
        expect(await store.products.countAsync()).toBe(1);

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        // The removal is an UPDATE to the backend, so the cache has to invalidate on updates
        // and not just on deletes, or the row stays visible forever.
        expect(await store.products.countAsync()).toBe(0);
    });

    forEachSubject('keeps the audit trail readable through the cache', async subject => {
        const { store } = await clean(subject);

        // Warm the cache on an empty history, then write through it.
        expect(await store.history.countAsync()).toBe(0);

        await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        await store.saveChangesAsync();

        // Audit rows are written by the store rather than by the history collection, so the
        // cache only invalidates them because they are part of the same save.
        expect(await store.history.countAsync()).toBe(1);
    });

    forEachSubject('reports only the caller\'s own changes', async subject => {
        const { store } = await clean(subject);

        await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        const result = await store.saveChangesAsync();

        // One product. The audit row rode along, but the caller did not add it.
        expect(result.aggregate.adds).toBe(1);
    });

    forEachSubject('survives a full lifecycle', async subject => {
        const { store, raw } = await clean(subject);

        const [product] = await store.products.addAsync({ name: 'Widget', price: 10, deletedAt: null } as any);
        await store.saveChangesAsync();

        product.price = 12;
        await store.saveChangesAsync();

        await store.products.removeAsync(product);
        await store.saveChangesAsync();

        const trail = (await store.history.sort(h => h.at).toArrayAsync()).map(h => h.operation);

        // add, the price change, then the soft delete — three updates to the trail, one row
        // still in the table, and nothing visible to the application.
        expect(trail).toEqual(['add', 'update', 'update']);
        expect(await store.products.countAsync()).toBe(0);
        expect(await raw.products.countAsync()).toBe(1);
    });
});
