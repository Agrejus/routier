import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { s } from '@routier/core/schema';
import { ConcurrencyDbPlugin, OptimisticConcurrencyError } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { describePluginContract } from '@routier/test-utils';

/**
 * Routier against a real MySQL server, started in a container.
 *
 * Before this file the MySQL plugin had never run against MySQL. Everything it was judged on
 * was a string-shape test over the builders, which cannot see the three things this engine
 * does differently from the others the suite already covers:
 *
 *  - **DDL implicitly commits.** Creating a table from inside a transaction ends it, so a
 *    later failure in the same save rolls back nothing.
 *  - **There is no RETURNING.** Written rows are read back by a second statement, and every
 *    mode of doing that (auto-increment range, key list, composite tuples) is an assumption
 *    about what the server did.
 *  - **A conflict is `affectedRows === 0`,** not an empty result set.
 *
 * Opt-in behind E2E_CONTAINERS, like the PostgreSQL suite: containers need Docker and a
 * multi-second startup.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';

// describe.skip rather than an early return, so the suite is listed as skipped instead of
// silently reporting an empty file.
const suite = shouldRun ? describe : describe.skip;

const schema = s.define('e2e_my_products', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

class ProductStore extends DataStore {
    products = this.collection(schema).proxy().create();
}

suite('MySQL via testcontainers', () => {
    let container: StartedMySqlContainer;
    let store: ProductStore;

    /** Opened inside a test, disposed after it — each plugin builds its own mysql2 pool. */
    const opened: DataStore[] = [];

    const pluginConfig = () => ({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getUserPassword(),
    });

    const connect = () => {
        const created = new ProductStore(new MysqlDbPlugin(pluginConfig()));
        opened.push(created);
        return created;
    };

    afterEach(async () => {
        for (const created of opened.splice(0)) {
            await created.destroyAsync().catch(() => undefined);
        }
    });

    beforeAll(async () => {
        container = await new MySqlContainer('mysql:8.0').start();
        // Not tracked: shared by every test, disposed in afterAll. `destroy()` ends the
        // pool and does not drop tables, so per-test disposal leaves these rows alone.
        store = new ProductStore(new MysqlDbPlugin(pluginConfig()));

        await store.products.addAsync(
            { name: 'apple', category: 'fruit', price: 10 } as any,
            { name: 'Banana', category: 'fruit', price: 30 } as any,
            { name: 'cherry', category: 'dry', price: 20 } as any,
        );
        await store.saveChangesAsync();
    }, 180_000);

    afterAll(async () => {
        await store?.destroyAsync().catch(() => undefined);
        await container?.stop();
    });

    it('creates its table on first use', async () => {
        expect(await store.products.countAsync()).toBe(3);
    });

    it('reads rows back through a second connection', async () => {
        expect(await connect().products.countAsync()).toBe(3);
    });

    it('filters with a comparison', async () => {
        const found = await store.products.where(p => p.price > 15).toArrayAsync();

        expect(found.map(p => p.name).sort()).toEqual(['Banana', 'cherry']);
    });

    it('filters with equality on a string', async () => {
        expect(await store.products.where(p => p.category === 'fruit').countAsync()).toBe(2);
    });

    it('sorts numerically', async () => {
        const found = await store.products.sort(p => p.price).toArrayAsync();

        expect(found.map(p => p.price)).toEqual([10, 20, 30]);
    });

    it('aggregates', async () => {
        expect(await store.products.sumAsync(p => p.price)).toBe(60);
        expect(await store.products.minAsync(p => p.price)).toBe(10);
        expect(await store.products.maxAsync(p => p.price)).toBe(30);
    });

    it('persists an update', async () => {
        const found = await store.products.firstAsync(p => p.name === 'apple');
        found.price = 99;
        await store.saveChangesAsync();

        expect((await connect().products.firstAsync(p => p.name === 'apple')).price).toBe(99);
    });

    it('persists a removal', async () => {
        const target = await store.products.firstAsync(p => p.name === 'cherry');
        await store.products.removeAsync(target);
        await store.saveChangesAsync();

        expect(await connect().products.countAsync()).toBe(2);
    });

    describe('column shapes', () => {
        const jsonSchema = s.define('e2e_my_json', {
            _id: s.string().key().identity(),
            name: s.string(),
            nested: s.object({ inner: s.object({ value: s.string(), count: s.number() }) }),
            tags: s.array(s.string()),
        }).compile();

        const renamedSchema = s.define('e2e_my_renamed', {
            _id: s.string().key().identity(),
            label: s.string().from('wire_label'),
            amount: s.number().from('wire_amount'),
        }).compile();

        class JsonStore extends DataStore {
            rows = this.collection(jsonSchema).proxy().create();
        }

        class RenamedStore extends DataStore {
            rows = this.collection(renamedSchema).proxy().create();
        }

        const open = <T extends DataStore>(Ctor: new (plugin: MysqlDbPlugin) => T): T => {
            const created = new Ctor(new MysqlDbPlugin(pluginConfig()));
            opened.push(created);
            return created;
        };

        it('round-trips a nested object and an array through JSON columns', async () => {
            const writer = open(JsonStore);

            await writer.rows.addAsync({
                name: 'alpha',
                nested: { inner: { value: 'deep', count: 3 } },
                tags: ['a', 'b'],
            } as any);
            await writer.saveChangesAsync();

            const found: any = await open(JsonStore).rows.firstAsync();

            // A JSON column returned as a raw string passes a shallow equality check but
            // fails on the first property access, so both are asserted.
            expect(typeof found.nested).toBe('object');
            expect(found.nested.inner).toEqual({ value: 'deep', count: 3 });
            expect(found.tags).toEqual(['a', 'b']);
        });

        it('persists a partial patch to a nested value without dropping its siblings', async () => {
            const writer = open(JsonStore);
            await writer.rows.addAsync({
                name: 'beta',
                nested: { inner: { value: 'before', count: 7 } },
                tags: [],
            } as any);
            await writer.saveChangesAsync();

            const second = open(JsonStore);
            const target = await second.rows.firstAsync(r => r.name === 'beta');
            second.rows.update(target, { nested: { inner: { value: 'after' } } } as any);
            await second.saveChangesAsync();

            const reread: any = await open(JsonStore).rows.firstAsync(r => r.name === 'beta');

            expect(reread.nested.inner.value).toBe('after');
            expect(reread.nested.inner.count).toBe(7);
        });

        it('writes and reads renamed columns by their storage names', async () => {
            const writer = open(RenamedStore);

            await writer.rows.addAsync({ label: 'visible', amount: 5 } as any);
            await writer.saveChangesAsync();

            const found: any = await open(RenamedStore).rows.firstAsync();

            expect(found.label).toBe('visible');
            expect(found.amount).toBe(5);
        });
    });

    describe('composite keys', () => {
        const compositeSchema = s.define('e2e_my_composite', {
            tenantId: s.string().key(),
            sku: s.string().key(),
            quantity: s.number(),
        }).compile();

        class CompositeStore extends DataStore {
            rows = this.collection(compositeSchema).proxy().create();
        }

        const open = () => {
            const created = new CompositeStore(new MysqlDbPlugin(pluginConfig()));
            opened.push(created);
            return created;
        };

        it('stores rows that differ only in the second key component', async () => {
            const writer = open();

            await writer.rows.addAsync(
                { tenantId: 'acme', sku: 'a', quantity: 1 } as any,
                { tenantId: 'acme', sku: 'b', quantity: 2 } as any,
            );
            await writer.saveChangesAsync();

            expect(await open().rows.countAsync()).toBe(2);
        });

        // The composite-key defect (known-defects #29) in its real form: two rows sharing
        // their FIRST key component, updated in one save. A WHERE built from
        // `idProperties[0]` alone matches both and the CASE form copies one row's value
        // over the other — with no error and a non-zero affected-row count.
        it('updates only the addressed row when rows share a key component', async () => {
            const writer = open();

            await writer.rows.addAsync(
                { tenantId: 'shared', sku: 'first', quantity: 10 } as any,
                { tenantId: 'shared', sku: 'second', quantity: 20 } as any,
            );
            await writer.saveChangesAsync();

            const editor = open();
            const target = await editor.rows.firstAsync(r => r.sku === 'first');
            target.quantity = 111;
            await editor.saveChangesAsync();

            const reader = open();
            const rows = await reader.rows.where(r => r.tenantId === 'shared').toArrayAsync();

            expect(rows.find(r => r.sku === 'first')!.quantity).toBe(111);
            expect(rows.find(r => r.sku === 'second')!.quantity).toBe(20);
        });

        it('removes only the addressed row when rows share a key component', async () => {
            const writer = open();

            await writer.rows.addAsync(
                { tenantId: 'rm', sku: 'keep', quantity: 1 } as any,
                { tenantId: 'rm', sku: 'drop', quantity: 2 } as any,
            );
            await writer.saveChangesAsync();

            const remover = open();
            await remover.rows.removeAsync(await remover.rows.firstAsync(r => r.sku === 'drop'));
            await remover.saveChangesAsync();

            const left = await open().rows.where(r => r.tenantId === 'rm').toArrayAsync();

            expect(left.map(r => r.sku)).toEqual(['keep']);
        });
    });

    describe('heterogeneous update batches', () => {
        const heteroSchema = s.define('e2e_my_hetero', {
            id: s.string().key(),
            a: s.string(),
            b: s.number(),
        }).compile();

        class HeteroStore extends DataStore {
            rows = this.collection(heteroSchema).proxy().create();
        }

        const open = () => {
            const created = new HeteroStore(new MysqlDbPlugin(pluginConfig()));
            opened.push(created);
            return created;
        };

        // Defect #22's shape. mysql2 runs with multipleStatements off, so two ';'-joined
        // groups in one prepared statement are rejected outright.
        it('updates two rows whose changed columns differ in one save', async () => {
            const writer = open();

            await writer.rows.addAsync(
                { id: 'x', a: 'a1', b: 1 } as any,
                { id: 'y', a: 'a2', b: 2 } as any,
            );
            await writer.saveChangesAsync();

            const editor = open();
            const rows = await editor.rows.toArrayAsync();
            const x = rows.find(r => r.id === 'x')!;
            const y = rows.find(r => r.id === 'y')!;

            x.a = 'x-new';
            y.a = 'y-new';
            y.b = 99;

            await editor.saveChangesAsync();

            const after = await open().rows.toArrayAsync();

            expect(after.find(r => r.id === 'x')!.a).toBe('x-new');
            expect(after.find(r => r.id === 'y')!.a).toBe('y-new');
            expect(after.find(r => r.id === 'y')!.b).toBe(99);
        });
    });

    describe('auto-increment select-back', () => {
        const autoSchema = s.define('e2e_my_autoinc', {
            id: s.number().key().identity(),
            label: s.string(),
        }).compile();

        class AutoStore extends DataStore {
            rows = this.collection(autoSchema).proxy().create();
        }

        const open = () => {
            const created = new AutoStore(new MysqlDbPlugin(pluginConfig()));
            opened.push(created);
            return created;
        };

        // The plugin reads inserted rows back by the AUTO_INCREMENT range
        // `insertId .. insertId + n - 1`, which is only contiguous under
        // innodb_autoinc_lock_mode 0/1 with one INSERT per batch. The row-count assertion in
        // the plugin is what turns a violated assumption into a failed save; these cases
        // prove the assumption holds for the statements it actually emits.
        it('echoes every row of a multi-row insert', async () => {
            const writer = open();

            const added = await writer.rows.addAsync(
                { label: 'one' } as any,
                { label: 'two' } as any,
                { label: 'three' } as any,
            );
            await writer.saveChangesAsync();

            expect(added.map((r: any) => r.id).filter((id: unknown) => id != null)).toHaveLength(3);
            expect(await open().rows.countAsync()).toBe(3);
        });

        it('assigns distinct ids across separate saves', async () => {
            const writer = open();

            await writer.rows.addAsync({ label: 'four' } as any);
            await writer.saveChangesAsync();
            await writer.rows.addAsync({ label: 'five' } as any);
            await writer.saveChangesAsync();

            const ids = (await open().rows.toArrayAsync()).map((r: any) => r.id);

            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('optimistic concurrency', () => {
        const occSchema = s.define('e2e_my_occ', {
            id: s.string().key().identity(),
            balance: s.number(),
        }).compile();

        class OccStore extends DataStore {
            accounts = this.collection(occSchema).proxy().create();
        }

        const open = () => {
            const created = new OccStore(new ConcurrencyDbPlugin(new MysqlDbPlugin(pluginConfig())));
            opened.push(created);
            return created;
        };

        it('rejects a stale write and allows a retry', async () => {
            const writerA = open();
            const writerB = open();

            const [seeded] = await writerA.accounts.addAsync({ balance: 1000 } as any);
            await writerA.saveChangesAsync();
            const id = (seeded as any).id;

            const a: any = await writerA.accounts.firstAsync(([x, p]) => x.id === p.id, { id });
            const b: any = await writerB.accounts.firstAsync(([x, p]) => x.id === p.id, { id });

            a.balance = 900;
            await writerA.saveChangesAsync();

            b.balance = 1100;
            const error = await writerB.saveChangesAsync().then(() => null, e => e);

            // MySQL reports this as affectedRows === 0 rather than an empty RETURNING set.
            expect(OptimisticConcurrencyError.is(error)).toBe(true);

            const fresh: any = await open().accounts.firstAsync(([x, p]) => x.id === p.id, { id });
            expect(fresh.balance).toBe(900);

            fresh.balance = 650;
            await open().saveChangesAsync().catch(() => undefined);
        });
    });

    describe('failure paths', () => {
        const failSchema = s.define('e2e_my_failures', {
            id: s.string().key(),
            value: s.string(),
        }).compile();

        class FailStore extends DataStore {
            rows = this.collection(failSchema).proxy().create();
        }

        const open = (poolMax?: number) => {
            const created = new FailStore(new MysqlDbPlugin({
                ...pluginConfig(),
                ...(poolMax == null ? {} : { pool: { max: poolMax } }),
            }));
            opened.push(created);
            return created;
        };

        it('rejects a duplicate primary key instead of hanging', async () => {
            const writer = open();
            await writer.rows.addAsync({ id: 'dup', value: 'first' } as any);
            await writer.saveChangesAsync();

            const second = open();
            await second.rows.addAsync({ id: 'dup', value: 'second' } as any);

            const outcome = await second.saveChangesAsync().then(() => 'resolved', e => e);

            expect(outcome).not.toBe('resolved');
        });

        // The DDL-inside-the-transaction defect. MySQL commits implicitly on CREATE TABLE,
        // so a save that created a table and then failed used to leave the earlier writes
        // durable with nothing for the ROLLBACK to undo. Table creation now happens before
        // the transaction opens, which is what makes this rollback total.
        it('rolls the whole batch back when one row fails', async () => {
            const writer = open();
            await writer.rows.addAsync({ id: 'existing', value: 'original' } as any);
            await writer.saveChangesAsync();

            const second = open();
            await second.rows.addAsync(
                { id: 'newcomer', value: 'should not survive' } as any,
                { id: 'existing', value: 'collides' } as any,
            );
            await second.saveChangesAsync().catch(() => undefined);

            const reader = open();
            const present = (await reader.rows.toArrayAsync()).map(r => r.id);

            expect(present).not.toContain('newcomer');
            expect((await reader.rows.firstAsync(r => r.id === 'existing')).value).toBe('original');
        });

        it('returns its connection to the pool after a failed save', async () => {
            // A pool of one: an unreleased connection makes the next statement wait forever.
            // The release used to be skipped whenever the rollback itself threw.
            const writer = open(1);
            await writer.rows.addAsync({ id: 'pool-check', value: 'seed' } as any);
            await writer.saveChangesAsync();

            const second = open(1);
            await second.rows.addAsync({ id: 'pool-check', value: 'collides' } as any);
            await second.saveChangesAsync().catch(() => undefined);

            expect(await second.rows.countAsync()).toBeGreaterThan(0);
        });
    });

    describe('configuration', () => {
        it('accepts a connection string on its own', async () => {
            const { host, port, database, user, password } = pluginConfig();
            const created = new ProductStore(new MysqlDbPlugin({
                connectionString: `mysql://${user}:${password}@${host}:${port}/${database}`,
            }));
            opened.push(created);

            expect(await created.products.countAsync()).toBeGreaterThan(0);
        });

        it('refuses a connection string mixed with discrete fields', () => {
            // No silent precedence: a connection string disagreeing with an explicit host
            // means the caller believes something untrue about where their data goes.
            expect(() => new MysqlDbPlugin({
                connectionString: 'mysql://user:pass@localhost:3306/db',
                host: 'elsewhere',
                database: 'other',
            })).toThrow(/mutually exclusive/);
        });

        it('requires a database when no connection string is given', () => {
            expect(() => new MysqlDbPlugin({} as any)).toThrow(/database.*required/);
        });
    });
});

/**
 * The plugin contract kit, against a real server.
 *
 * The kit expects each `factory()` call to hand back an EMPTY database — the SQLite binding
 * passes a fresh file name per call, the memory one a fresh database name — because its
 * `afterEach` cleans up by calling `destroy()`, and on a server plugin `destroy()` ends the
 * connection pool rather than dropping tables. Sharing one MySQL database across the kit
 * therefore accumulated rows and every count assertion after the first drifted.
 *
 * So isolation comes from the factory here too: a batch of empty databases is created up
 * front and handed out one per call. Pre-created rather than created on demand because the
 * factory is synchronous — issuing `CREATE DATABASE` without awaiting it would race the
 * plugin's first query.
 *
 * Its own container, so the batch of databases does not sit alongside the suite above.
 */
if (shouldRun) {
    describe('MySQL plugin contract', () => {
        let container: StartedMySqlContainer;

        /** Enough for every `store()` call the kit makes, with headroom. */
        const DATABASE_COUNT = 260;
        const databaseNames: string[] = [];
        let nextDatabase = 0;

        beforeAll(async () => {
            container = await new MySqlContainer('mysql:8.0').start();

            // mysql2 is only a devDependency of the plugin, but it is installed — the kit
            // needs raw access to create the databases the plugin will then connect to.
            const { createConnection } = await import('mysql2/promise');
            const admin = await createConnection({
                host: container.getHost(),
                port: container.getPort(),
                user: 'root',
                password: container.getRootPassword(),
            });

            try {
                for (let i = 0; i < DATABASE_COUNT; i++) {
                    const name = `contract_${i}`;
                    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
                    databaseNames.push(name);
                }
            } finally {
                await admin.end();
            }
        }, 300_000);

        afterAll(async () => {
            await container?.stop();
        });

        describePluginContract(
            'mysql',
            () => {
                const database = databaseNames[nextDatabase++];

                if (database == null) {
                    throw new Error(
                        `MySQL contract kit exhausted its ${DATABASE_COUNT} pre-created databases. ` +
                        `Raise DATABASE_COUNT — the kit calls the factory once per store, and each ` +
                        `one needs an empty database.`
                    );
                }

                return new MysqlDbPlugin({
                    host: container.getHost(),
                    port: container.getPort(),
                    database,
                    user: 'root',
                    password: container.getRootPassword(),
                });
            },
            {
                // Off for the same reason as SQLite, and it is a SQL-shaped reason rather
                // than a MySQL one: a column either holds NULL or a value, so an OPTIONAL
                // property that was never set is indistinguishable from one explicitly set
                // to null. The contract's rich-type cases require that distinction to
                // survive a round trip, and no SQL plugin here can offer it without
                // per-property serializers at the schema level.
                //
                // What MySQL genuinely does support natively — JSON columns for nested
                // objects and arrays, DATETIME, and booleans decoded back from TINYINT — is
                // covered against this same server by the 'column shapes' block above.
                supportsRichTypes: false,
                knownFailing: [],
            },
        );
    });
}
