import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';

/**
 * Views against real databases, in both of the shapes a view can take.
 *
 * A view is persisted — its rows are written to the backend through the plugin — so how it
 * reconciles is only fully observable against a store that actually keeps them. The unit tests
 * run over the memory plugin, where "the view's contents" and "the object graph" are the same
 * thing; here the rows survive in a file and in a server.
 *
 * The two shapes are not a setting. They follow from how the caller declared the KEY, which is
 * the whole point being pinned:
 *
 *  - a stable key — the view mirrors its derivation, and a row that stops qualifying is
 *    removed. This is what makes a view usable as a synced subset instead of something that
 *    grows towards the full table.
 *  - a key computed from the row's content — every version has its own key, so the view is an
 *    append-only history and superseded rows stay.
 *
 * SQLite runs unconditionally against a real file; PostgreSQL runs behind E2E_CONTAINERS.
 */

const productSchema = s.define('e2e_view_products', {
    id: s.number().key(),
    name: s.string(),
    active: s.boolean(),
}).compile();

/** Stable key: `view:${source id}` is the same string for every version of a product. */
const activeSchema = s.define('e2e_view_active', {
    id: s.string().key(),
    name: s.string(),
}).compile();

/** Computed key: changes with the content, so each version lands as its own row. */
const historySchema = s.define('e2e_view_history', {
    name: s.string(),
    active: s.boolean(),
}).modify(x => ({
    id: x.computed(entity => `${entity.name}|${entity.active}`).tracked().key(),
})).compile();

class ViewStore extends DataStore {
    products = this.collection(productSchema).proxy().create();

    activeProducts = this.view(activeSchema)
        .derive(cb => {
            const recompute = () => {
                this.products.where(x => x.active === true).toArray(r => {
                    if (r.ok === 'error') { throw r.error; }
                    cb(r.data.map(p => ({ id: `view:${p.id}`, name: p.name })) as any[]);
                });
            };

            recompute();
            return this.products.subscribe().toArray(r => {
                if (r.ok === 'error') { throw r.error; }
                recompute();
            });
        })
        .create();

    productHistory = this.view(historySchema)
        .derive(cb => {
            const recompute = () => {
                this.products.toArray(r => {
                    if (r.ok === 'error') { throw r.error; }
                    cb(r.data.map(p => ({ name: p.name, active: p.active })) as any[]);
                });
            };

            recompute();
            return this.products.subscribe().toArray(r => {
                if (r.ok === 'error') { throw r.error; }
                recompute();
            });
        })
        .create();
}

/**
 * Plain collections over the same three tables.
 *
 * A view is read-only, so emptying one between cases needs a store that does not declare it as
 * a view. It is also how the view's stored rows are inspected without going through the
 * derivation that produced them.
 */
class RawStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
    active = this.collection(activeSchema).proxy().create();
    history = this.collection(historySchema).proxy().create();
}

type Subject = { readonly name: string, readonly plugin: () => IDbPlugin };

const subjects: Subject[] = [];
const directories: string[] = [];
let container: StartedPostgreSqlContainer | undefined;

const shouldRunContainers = process.env.E2E_CONTAINERS === '1';

beforeAll(async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-views-'));
    directories.push(directory);

    const file = path.join(directory, `${uuidv4()}.sqlite`);
    subjects.push({ name: 'SQLite', plugin: () => new SqliteDbPlugin(file) });

    if (shouldRunContainers) {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();

        const config = {
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        };

        subjects.push({ name: 'PostgreSQL', plugin: () => new PostgresDbPlugin(config) });
    }
}, 180_000);

afterAll(async () => {
    await container?.stop();

    for (const directory of directories) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

const opened: DataStore[] = [];

afterEach(async () => {
    for (const store of opened.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

/**
 * Polls until `assertion` passes.
 *
 * A view recomputes off a subscription, so its rows appear a moment after the save that caused
 * them. A fixed sleep long enough for a container would make the SQLite run needlessly slow and
 * would still be a guess; polling settles as fast as the backend allows and fails with the real
 * assertion error rather than a timeout.
 */
const waitFor = async (assertion: () => Promise<void>, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs;

    for (; ;) {
        try {
            await assertion();
            return;
        } catch (error) {
            if (Date.now() > deadline) {
                throw error;
            }

            await new Promise(resolve => setTimeout(resolve, 25));
        }
    }
};

describe('views against a real database', () => {

    const forEachSubject = (name: string, body: (subject: Subject) => Promise<void>) => {
        it(name, async () => {
            for (const subject of subjects) {
                await body(subject);
            }
        }, 60_000);
    };

    /** Empties all three tables, then opens a store whose views derive from nothing. */
    const clean = async (subject: Subject) => {
        const raw = new RawStore(subject.plugin());
        opened.push(raw);

        for (const collection of [raw.products, raw.active, raw.history] as const) {
            const existing = await collection.toArrayAsync();

            if (existing.length > 0) {
                await collection.removeAsync(...(existing as never[]));
            }
        }

        await raw.saveChangesAsync();

        const store = new ViewStore(subject.plugin());
        opened.push(store);

        return { store, raw };
    };

    it('runs against every subject the environment allows', () => {
        // Every case below loops over this list, which is the shape that passes quietly when
        // the list is short — a container that failed to start would leave the suite green.
        expect(subjects.map(x => x.name)).toEqual(
            shouldRunContainers ? ['SQLite', 'PostgreSQL'] : ['SQLite']
        );
    });

    describe('a stable key mirrors the derivation', () => {

        forEachSubject('writes derived rows to the database', async subject => {
            const { store, raw } = await clean(subject);

            await store.products.addAsync(
                { id: 1, name: 'a', active: true } as any,
                { id: 2, name: 'b', active: true } as any,
            );
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect((await store.activeProducts.toArrayAsync()).map(x => x.name).sort()).toEqual(['a', 'b']);
            });

            // Read without the view, to prove the rows are really in the table rather than
            // being recomputed on the way out.
            expect(await raw.active.countAsync()).toBe(2);
        });

        forEachSubject('removes a row that stops qualifying', async subject => {
            const { store, raw } = await clean(subject);

            const [a] = await store.products.addAsync(
                { id: 1, name: 'a', active: true } as any,
                { id: 2, name: 'b', active: true } as any,
            );
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.activeProducts.countAsync()).toBe(2);
            });

            a.active = false;
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect((await store.activeProducts.toArrayAsync()).map(x => x.name)).toEqual(['b']);
            });

            // Gone from the table, not merely filtered out of the read.
            expect(await raw.active.countAsync()).toBe(1);
        });

        forEachSubject('updates in place rather than adding a row', async subject => {
            const { store } = await clean(subject);

            const [a] = await store.products.addAsync({ id: 1, name: 'a', active: true } as any);
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.activeProducts.countAsync()).toBe(1);
            });

            a.name = 'renamed';
            await store.saveChangesAsync();

            await waitFor(async () => {
                const rows = await store.activeProducts.toArrayAsync();

                // The key is `view:1` before and after, so this is one row that changed.
                expect(rows).toHaveLength(1);
                expect(rows[0].name).toBe('renamed');
            });
        });

        forEachSubject('empties when the derivation produces nothing', async subject => {
            const { store, raw } = await clean(subject);

            const [a] = await store.products.addAsync({ id: 1, name: 'a', active: true } as any);
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.activeProducts.countAsync()).toBe(1);
            });

            a.active = false;
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.activeProducts.countAsync()).toBe(0);
            });

            expect(await raw.active.countAsync()).toBe(0);
        });
    });

    describe('a computed key accumulates', () => {

        forEachSubject('keeps the superseded version', async subject => {
            const { store } = await clean(subject);

            const [a] = await store.products.addAsync({ id: 1, name: 'a', active: true } as any);
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.productHistory.countAsync()).toBe(1);
            });

            a.active = false;
            await store.saveChangesAsync();

            // Same view, same save, opposite outcome to the mirror above — decided only by the
            // key being computed from the row's content.
            await waitFor(async () => {
                const rows = await store.productHistory.toArrayAsync();

                expect(rows).toHaveLength(2);
                expect(rows.map(r => r.id).sort()).toEqual(['a|false', 'a|true']);
            });
        });

        forEachSubject('does not re-add a version it already holds', async subject => {
            const { store } = await clean(subject);

            const [a] = await store.products.addAsync({ id: 1, name: 'a', active: true } as any);
            await store.saveChangesAsync();

            a.active = false;
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.productHistory.countAsync()).toBe(2);
            });

            a.active = true;
            await store.saveChangesAsync();

            // Returning to a previous state recomputes a key the view already has, so there is
            // nothing to insert. A history keyed by content records distinct STATES, not
            // transitions.
            await waitFor(async () => {
                expect(await store.productHistory.countAsync()).toBe(2);
            });
        });

        forEachSubject('keeps history after the source row is deleted', async subject => {
            const { store } = await clean(subject);

            const [a] = await store.products.addAsync({ id: 1, name: 'a', active: true } as any);
            await store.saveChangesAsync();

            await waitFor(async () => {
                expect(await store.productHistory.countAsync()).toBe(1);
            });

            await store.products.removeAsync(a);
            await store.saveChangesAsync();

            // The derivation now produces nothing at all. A mirror empties; the history must
            // not, or deleting a row would erase the record that it ever existed.
            //
            // The mirror is what this waits on. "History is still 1" was already true before
            // the recompute, so waiting on it returns immediately and proves nothing — the
            // assertion that has to CHANGE is the one worth polling.
            await waitFor(async () => {
                expect(await store.activeProducts.countAsync()).toBe(0);
            });

            expect(await store.productHistory.countAsync()).toBe(1);
        });
    });

    forEachSubject('runs both shapes over one source collection', async subject => {
        const { store } = await clean(subject);

        const [a] = await store.products.addAsync(
            { id: 1, name: 'a', active: true } as any,
            { id: 2, name: 'b', active: true } as any,
        );
        await store.saveChangesAsync();

        // Settled before the second save on purpose. Firing both and waiting once at the end
        // depends on two in-flight recomputes landing in the order they were started, and they
        // do not — see the staleness note in View.ts. That is a real defect, but it is not the
        // one this case is about, and letting it fail here would hide what is.
        await waitFor(async () => {
            expect(await store.activeProducts.countAsync()).toBe(2);
        });

        a.active = false;
        await store.saveChangesAsync();

        // One store, one source, two views that disagree about what to do with the same
        // change — which is the point of deriving the answer from each view's own key.
        await waitFor(async () => {
            expect(await store.activeProducts.countAsync()).toBe(1);
            expect(await store.productHistory.countAsync()).toBe(3);
        });
    });
});
