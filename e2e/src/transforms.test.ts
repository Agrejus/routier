import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s, SchemaTypes } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import type { IDbPlugin } from '@routier/core/plugins';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { createKeyring, encryption, isEnvelope } from '@routier/encryption';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { MysqlDbPlugin } from '@routier/mysql-plugin';

/**
 * Transforms end to end, through a real store and real backends.
 *
 * A transform is declared on the schema and run by the datastore, between the change tracker
 * and the plugin. Nothing below that line knows one happened, which is why the same schema
 * works unchanged on an in-process store, IndexedDB and SQLite.
 *
 * The assertions that matter are the ones that read the backend directly. "It round-trips"
 * would pass just as well with a transform that did nothing at all.
 */

const keyringOf = () => createKeyring({
    activeKeyId: 'k1',
    keys: { k1: crypto.getRandomValues(new Uint8Array(32)) },
});

const stores: DataStore[] = [];
const files: string[] = [];

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
    files.splice(0);
});

const databases: [string, () => IDbPlugin][] = [
    ['memory', () => new MemoryPlugin(`tx-${uuidv4()}`)],
    ['dexie', () => new DexiePlugin(`tx-${uuidv4()}`)],
    ['sqlite', () => {
        const file = `tx-${uuidv4()}.sqlite`;
        files.push(file);
        return new SqliteDbPlugin(file);
    }],
];

describe('transforms', () => {

    describe.each(databases)('with the %s database', (_name, plugin) => {

        const build = async () => {
            const keyring = await keyringOf();
            const cipher = encryption(keyring);
            const searchable = encryption(keyring, { searchable: true });

            const userSchema = s.define('tx_users', {
                id: s.string().key().identity(),
                tenant: s.string().index(),
                email: s.string(),
                notes: s.string(),
                salary: s.number(),
                plain: s.string(),
            }).modify(x => ({
                email: x.transform(searchable),
                notes: x.transform(cipher),
                salary: x.transform(cipher),
            })).compile();

            class UserStore extends DataStore {
                users = this.collection(userSchema).proxy().create();
            }

            return { store: track(new UserStore(plugin())), cipher };
        };

        it('round-trips every transformed property as itself', async () => {
            const { store } = await build();

            await store.users.addAsync({
                tenant: 't1', email: 'ada@example.com', notes: 'confidential',
                salary: 125000.5, plain: 'visible',
            } as never);
            await store.saveChangesAsync();

            const [saved] = await store.users.toArrayAsync() as {
                email: string; notes: string; salary: number; plain: string;
            }[];

            expect(saved.email).toBe('ada@example.com');
            expect(saved.notes).toBe('confidential');
            expect(saved.salary).toBe(125000.5);
            expect(typeof saved.salary).toBe('number');
            expect(saved.plain).toBe('visible');
        });

        it('finds a row by a searchable transformed property', async () => {
            // The filter value is transformed on the way down, so the database compares
            // stored form to stored form and uses its index.
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'ada@example.com', notes: 'a', salary: 1, plain: 'p' } as never);
            await store.users.addAsync({ tenant: 't1', email: 'grace@example.com', notes: 'b', salary: 2, plain: 'p' } as never);
            await store.saveChangesAsync();

            const found = await store.users
                .where(([u, p]) => u.email === p.email, { email: 'grace@example.com' })
                .toArrayAsync() as { email: string; notes: string }[];

            expect(found).toHaveLength(1);
            expect(found[0].email).toBe('grace@example.com');
            expect(found[0].notes).toBe('b');
        });

        it('refuses to filter a property whose transform is not comparable', async () => {
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'secret', salary: 1, plain: 'p' } as never);
            await store.saveChangesAsync();

            await expect(
                store.users.where(([u, p]) => u.notes === p.notes, { notes: 'secret' }).toArrayAsync()
            ).rejects.toThrow(/cannot be filtered/);
        });

        it('refuses an ordering comparison even on a comparable one', async () => {
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', salary: 1, plain: 'p' } as never);
            await store.saveChangesAsync();

            await expect(
                store.users.where(([u, p]) => u.email > p.email, { email: 'a' }).toArrayAsync()
            ).rejects.toThrow(/only an equality comparison/);
        });

        it('leaves untransformed properties fully queryable', async () => {
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', salary: 1, plain: 'p' } as never);
            await store.users.addAsync({ tenant: 't2', email: 'd@e.f', notes: 'n', salary: 2, plain: 'p' } as never);
            await store.saveChangesAsync();

            const found = await store.users
                .where(([u, p]) => u.tenant === p.tenant, { tenant: 't2' })
                .toArrayAsync() as { email: string }[];

            expect(found).toHaveLength(1);
            expect(found[0].email).toBe('d@e.f');
        });

        it('updates a transformed property in place', async () => {
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'old@example.com', notes: 'n', salary: 1, plain: 'p' } as never);
            await store.saveChangesAsync();

            const [user] = await store.users.toArrayAsync() as { email: string; salary: number }[];
            user.email = 'new@example.com';
            user.salary = 99;
            await store.saveChangesAsync();

            const [reread] = await store.users.toArrayAsync() as { email: string; salary: number }[];

            expect(reread.email).toBe('new@example.com');
            expect(reread.salary).toBe(99);
        });

        it('does not transform a value that came back from a query', async () => {
            // Saving an entity that was read must not transform its already-stored value a
            // second time.
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'once', salary: 1, plain: 'p' } as never);
            await store.saveChangesAsync();

            const [user] = await store.users.toArrayAsync() as { plain: string }[];
            user.plain = 'touched';
            await store.saveChangesAsync();

            const [reread] = await store.users.toArrayAsync() as { notes: string; salary: number }[];

            expect(reread.notes).toBe('once');
            expect(reread.salary).toBe(1);
        });

        it('removes a row that has transformed properties', async () => {
            const { store } = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', salary: 1, plain: 'p' } as never);
            await store.saveChangesAsync();

            const [user] = await store.users.toArrayAsync();
            await store.users.removeAsync(user as never);
            await store.saveChangesAsync();

            expect(await store.users.countAsync()).toBe(0);
        });
    });

    describe('what actually reaches the database', () => {

        /** Read behind the datastore's back: its own read path would transform on the way out. */
        const storedRows = (plugin: MemoryPlugin) => Object.values(
            (plugin as unknown as { database: Record<string, { data: Map<string, Record<string, unknown>> }> }).database
        ).flatMap(collection => [...collection.data.values()]);

        it('stores the transformed value, not the original', async () => {
            const keyring = await keyringOf();
            const inner = new MemoryPlugin(`raw-tx-${uuidv4()}`);

            const schema = s.define('tx_raw', {
                id: s.string().key().identity(),
                notes: s.string(),
                salary: s.number(),
                plain: s.string(),
            }).modify(x => ({
                notes: x.transform(encryption(keyring)),
                salary: x.transform(encryption(keyring)),
            })).compile();

            class Store extends DataStore { rows = this.collection(schema).proxy().create(); }

            const store = track(new Store(inner));

            await store.rows.addAsync({ notes: 'confidential', salary: 125000.5, plain: 'visible' } as never);
            await store.saveChangesAsync();

            const rows = storedRows(inner);

            // Or every assertion below would pass by reading nothing.
            expect(rows).toHaveLength(1);

            const [row] = rows;

            expect(isEnvelope(row.notes)).toBe(true);
            expect(isEnvelope(row.salary)).toBe(true);

            const serialised = JSON.stringify(row);
            expect(serialised).not.toContain('confidential');
            expect(serialised).not.toContain('125000.5');

            expect(row.plain).toBe('visible');
        });
    });

    describe('a transform that is not encryption at all', () => {

        it('runs whatever the caller supplied', async () => {
            // Nothing about encryption is privileged. Four lines of the caller's own code
            // work identically.
            const rot13 = {
                to: (v: string) => v.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97)),
                from: (v: unknown) => String(v).replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97)),
                stores: SchemaTypes.String,
                comparable: 'equality' as const,
            };

            const inner = new MemoryPlugin(`rot-${uuidv4()}`);

            const schema = s.define('tx_rot', {
                id: s.string().key().identity(),
                secret: s.string(),
            }).modify(x => ({ secret: x.transform(rot13) })).compile();

            class Store extends DataStore { rows = this.collection(schema).proxy().create(); }

            const store = track(new Store(inner));

            await store.rows.addAsync({ secret: 'hello' } as never);
            await store.saveChangesAsync();

            const rows = Object.values(
                (inner as unknown as { database: Record<string, { data: Map<string, Record<string, unknown>> }> }).database
            ).flatMap(c => [...c.data.values()]);

            expect(rows[0].secret).toBe('uryyb');

            const [read] = await store.rows.toArrayAsync() as { secret: string }[];
            expect(read.secret).toBe('hello');

            // And it is comparable, so a filter runs against the stored form.
            const found = await store.rows
                .where(([r, p]) => r.secret === p.secret, { secret: 'hello' })
                .toArrayAsync();

            expect(found).toHaveLength(1);
        });

        it('supports an async transform', async () => {
            const inner = new MemoryPlugin(`async-tx-${uuidv4()}`);

            const schema = s.define('tx_async', {
                id: s.string().key().identity(),
                value: s.string(),
            }).modify(x => ({
                value: x.transform({
                    to: async (v: string) => { await Promise.resolve(); return `wrapped:${v}`; },
                    from: async (v: unknown) => { await Promise.resolve(); return String(v).slice(8); },
                }),
            })).compile();

            class Store extends DataStore { rows = this.collection(schema).proxy().create(); }

            const store = track(new Store(inner));

            await store.rows.addAsync({ value: 'payload' } as never);
            await store.saveChangesAsync();

            const rows = Object.values(
                (inner as unknown as { database: Record<string, { data: Map<string, Record<string, unknown>> }> }).database
            ).flatMap(c => [...c.data.values()]);

            expect(rows[0].value).toBe('wrapped:payload');

            const [read] = await store.rows.toArrayAsync() as { value: string }[];
            expect(read.value).toBe('payload');
        });

        it('runs a one-way transform, which never comes back', async () => {
            // No `from`. The stored value is the value — the same thing `computed` does.
            const inner = new MemoryPlugin(`oneway-${uuidv4()}`);

            const schema = s.define('tx_oneway', {
                id: s.string().key().identity(),
                shout: s.string(),
            }).modify(x => ({
                shout: x.transform({ to: (v: string) => v.toUpperCase() }),
            })).compile();

            class Store extends DataStore { rows = this.collection(schema).proxy().create(); }

            const store = track(new Store(inner));

            await store.rows.addAsync({ shout: 'quiet' } as never);
            await store.saveChangesAsync();

            const [read] = await store.rows.toArrayAsync() as { shout: string }[];

            expect(read.shout).toBe('QUIET');
        });
    });

});

/**
 * The same transforms against real SQL servers.
 *
 * These are the engines that can reject what SQLite quietly coerces. A transform declaring
 * `stores: String` turns an encrypted NUMBER into a text column, and PostgreSQL will refuse a
 * ciphertext bound to a numeric column rather than storing something surprising — so this is
 * where the schema view either works or is exposed.
 *
 * Gated behind E2E_CONTAINERS with the rest of the container suites.
 */
const containerSuite = process.env.E2E_CONTAINERS === '1' ? describe : describe.skip;

containerSuite('transforms against real SQL servers', () => {
    let postgres: StartedPostgreSqlContainer;
    let mysql: StartedMySqlContainer;

    beforeAll(async () => {
        [postgres, mysql] = await Promise.all([
            new PostgreSqlContainer('postgres:16-alpine').start(),
            new MySqlContainer('mysql:8.0').start(),
        ]);
    }, 240_000);

    afterAll(async () => {
        await Promise.all([postgres?.stop(), mysql?.stop()]);
    });

    const engines: [string, () => IDbPlugin][] = [
        ['postgresql', () => new PostgresDbPlugin({
            host: postgres.getHost(),
            port: postgres.getPort(),
            database: postgres.getDatabase(),
            user: postgres.getUsername(),
            password: postgres.getPassword(),
        })],
        ['mysql', () => new MysqlDbPlugin({
            host: mysql.getHost(),
            port: mysql.getPort(),
            database: mysql.getDatabase(),
            user: mysql.getUsername(),
            password: mysql.getUserPassword(),
        })],
    ];

    describe.each(engines)('with %s', (name, plugin) => {

        /** A fresh collection per test: these servers keep their tables between tests. */
        const build = async () => {
            const keyring = await keyringOf();
            const cipher = encryption(keyring);
            const searchable = encryption(keyring, { searchable: true });
            const collection = `tx_${name}_${uuidv4().replace(/-/g, '')}`.slice(0, 40);

            const schema = s.define(collection, {
                id: s.string().key().identity(),
                tenant: s.string().index(),
                email: s.string(),
                notes: s.string(),
                salary: s.number(),
            }).modify(x => ({
                email: x.transform(searchable),
                notes: x.transform(cipher),
                salary: x.transform(cipher),
            })).compile();

            class Store extends DataStore {
                rows = this.collection(schema).proxy().create();
            }

            return track(new Store(plugin())) as DataStore & { rows: any };
        };

        it('stores an encrypted NUMBER in a text column and reads it back as a number', async () => {
            // The assertion the schema view exists for. Without `stores: String` the column
            // would be numeric and the server would reject the ciphertext outright.
            const store = await build();

            await store.rows.addAsync({
                tenant: 't1', email: 'ada@example.com', notes: 'confidential', salary: 125000.5,
            } as never);
            await store.saveChangesAsync();

            const [saved] = await store.rows.toArrayAsync() as { salary: number; notes: string }[];

            expect(saved.salary).toBe(125000.5);
            expect(typeof saved.salary).toBe('number');
            expect(saved.notes).toBe('confidential');
        });

        it('finds a row by a searchable transformed property', async () => {
            const store = await build();

            await store.rows.addAsync({ tenant: 't1', email: 'ada@example.com', notes: 'a', salary: 1 } as never);
            await store.rows.addAsync({ tenant: 't1', email: 'grace@example.com', notes: 'b', salary: 2 } as never);
            await store.saveChangesAsync();

            const found = await store.rows
                .where(([r, p]: any) => r.email === p.email, { email: 'grace@example.com' })
                .toArrayAsync() as { email: string; notes: string }[];

            expect(found).toHaveLength(1);
            expect(found[0].email).toBe('grace@example.com');
            expect(found[0].notes).toBe('b');
        });

        it('updates a transformed number through the delta path', async () => {
            // SQL writes the UPDATE from the delta, not the entity. Transforming one and not
            // the other put a raw number into a text column and read back "2.0".
            const store = await build();

            await store.rows.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', salary: 1 } as never);
            await store.saveChangesAsync();

            const [row] = await store.rows.toArrayAsync() as { salary: number }[];
            row.salary = 2;
            await store.saveChangesAsync();

            const [reread] = await store.rows.toArrayAsync() as { salary: number }[];

            expect(reread.salary).toBe(2);
        });

        it('leaves untransformed properties queryable', async () => {
            const store = await build();

            await store.rows.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', salary: 1 } as never);
            await store.rows.addAsync({ tenant: 't2', email: 'd@e.f', notes: 'n', salary: 2 } as never);
            await store.saveChangesAsync();

            const found = await store.rows
                .where(([r, p]: any) => r.tenant === p.tenant, { tenant: 't2' })
                .toArrayAsync() as { email: string }[];

            expect(found).toHaveLength(1);
            expect(found[0].email).toBe('d@e.f');
        });

        it('refuses to filter a property whose transform is not comparable', async () => {
            const store = await build();

            await store.rows.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'secret', salary: 1 } as never);
            await store.saveChangesAsync();

            await expect(
                store.rows.where(([r, p]: any) => r.notes === p.notes, { notes: 'secret' }).toArrayAsync()
            ).rejects.toThrow(/cannot be filtered/);
        });
    });
});
