import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { IDbPlugin } from '@routier/core';

/**
 * One matrix of SQL behaviour, run against every real engine.
 *
 * The audit asked for dialect conformance tests that EXECUTE generated SQL rather than
 * compare it to snapshots, and the reason is `plugins/sql-core/src/sql.test.ts`: string
 * assertions prove what the builder emits, not what an engine does with it. Both defects the
 * audit found in the equals path — a reversed null test rendering `? IS NULL`, and the
 * operand-order sentinel collision behind it — produce *valid* SQL. An engine runs them
 * happily and returns the wrong rows.
 *
 * The matrix is shared rather than written per plugin because the point is agreement. Every
 * case below is a question every engine must answer the same way, and a divergence is the
 * finding. SQLite alone is not evidence: it stores JSON as text, accepts several statements
 * in one call, and serialises writers at the file level, so it forgives three separate
 * classes of bug the others do not (see known-defects, "things that will mislead you" #3).
 *
 * Not covered here, deliberately: filters on RENAMED properties. Those are routed to
 * in-memory evaluation before a plugin ever sees them (`QueryOptionsCollection` flips the
 * execution target for any renamed or unmapped property), so asserting them here would be
 * asserting the JS fallback and would pass whatever the SQL layer did. Renamed columns are
 * covered on the write/read path instead, which does reach the engine.
 */

export type ConformanceBackend = {
    /** Appears in test names, so a failure names the engine. */
    name: string;
    /** A fresh plugin over the shared database for this backend. */
    createPlugin: () => IDbPlugin;
};

/**
 * Collection names carry the backend so two engines sharing one process cannot collide, and
 * so a leftover table from a previous run is visible rather than silently merged.
 */
const schemasFor = (suffix: string) => ({
    products: s.define(`conf_products_${suffix}`, {
        id: s.string().key(),
        name: s.string(),
        category: s.string(),
        price: s.number(),
        deletedAt: s.string().nullable(),
    }).compile(),

    composite: s.define(`conf_composite_${suffix}`, {
        tenant: s.string().key(),
        sku: s.string().key(),
        quantity: s.number(),
        label: s.string(),
    }).compile(),

    renamed: s.define(`conf_renamed_${suffix}`, {
        id: s.string().key(),
        label: s.string().from('wire_label'),
        amount: s.number().from('wire_amount'),
    }).compile(),

    nested: s.define(`conf_nested_${suffix}`, {
        id: s.string().key(),
        payload: s.object({ inner: s.object({ value: s.string(), count: s.number() }) }),
        tags: s.array(s.string()),
    }).compile(),
});

export function describeDialectConformance(backend: ConformanceBackend) {
    describe(`dialect conformance: ${backend.name}`, () => {
        const schemas = schemasFor(backend.name);

        class ProductStore extends DataStore {
            products = this.collection(schemas.products).proxy().create();
        }

        class CompositeStore extends DataStore {
            rows = this.collection(schemas.composite).proxy().create();
        }

        class RenamedStore extends DataStore {
            rows = this.collection(schemas.renamed).proxy().create();
        }

        class NestedStore extends DataStore {
            rows = this.collection(schemas.nested).proxy().create();
        }

        const opened: DataStore[] = [];

        const open = <T extends DataStore>(Ctor: new (plugin: IDbPlugin) => T): T => {
            const created = new Ctor(backend.createPlugin());
            opened.push(created);
            return created;
        };

        /**
         * Empties every table this matrix uses, before each test.
         *
         * Isolation cannot come from `destroy()` here. On SQLite it deletes the file, so each
         * test starts clean; on a server plugin it only ends the connection pool and the rows
         * stay. Without this the fixed seed ids collide on the second test against Postgres
         * and MySQL, and the whole matrix fails on a duplicate key rather than on anything it
         * is trying to measure.
         */
        beforeEach(async () => {
            const cleaner = open(class extends DataStore {
                products = this.collection(schemas.products).proxy().create();
                composite = this.collection(schemas.composite).proxy().create();
                renamed = this.collection(schemas.renamed).proxy().create();
                nested = this.collection(schemas.nested).proxy().create();
            } as never) as any;

            for (const name of ['products', 'composite', 'renamed', 'nested']) {
                const rows = await cleaner[name].toArrayAsync().catch(() => []);

                if (rows.length > 0) {
                    await cleaner[name].removeAsync(...rows);
                }
            }

            await cleaner.saveChangesAsync().catch(() => undefined);
        });

        afterEach(async () => {
            for (const created of opened.splice(0)) {
                await created.destroyAsync().catch(() => undefined);
            }
        });

        /** Four products, two of them with a null `deletedAt`. Seeded once per test. */
        const seededProducts = async () => {
            const store = open(ProductStore);

            await store.products.addAsync(
                { id: 'p1', name: 'apple', category: 'fruit', price: 10, deletedAt: null } as any,
                { id: 'p2', name: 'banana', category: 'fruit', price: 30, deletedAt: null } as any,
                { id: 'p3', name: 'cherry', category: 'dry', price: 20, deletedAt: '2024-01-01' } as any,
                { id: 'p4', name: 'date', category: 'dry', price: 40, deletedAt: '2024-02-01' } as any,
            );
            await store.saveChangesAsync();

            return store;
        };

        const names = (rows: { name: string }[]) => rows.map(r => r.name).sort();

        describe('comparators in both operand orders', () => {
            // Every case runs the predicate twice, with the property on each side. The two
            // must agree: a comparator whose swap is not applied returns the complement,
            // which is valid SQL and a silently wrong answer.
            const cases: {
                label: string;
                propertyLeft: (p: any) => boolean;
                valueLeft: (p: any) => boolean;
                expected: string[];
            }[] = [
                    {
                        label: 'greater than',
                        propertyLeft: p => p.price > 20,
                        valueLeft: p => 20 < p.price,
                        expected: ['banana', 'date'],
                    },
                    {
                        label: 'greater than or equal',
                        propertyLeft: p => p.price >= 20,
                        valueLeft: p => 20 <= p.price,
                        expected: ['banana', 'cherry', 'date'],
                    },
                    {
                        label: 'less than',
                        propertyLeft: p => p.price < 20,
                        valueLeft: p => 20 > p.price,
                        expected: ['apple'],
                    },
                    {
                        label: 'less than or equal',
                        propertyLeft: p => p.price <= 20,
                        valueLeft: p => 20 >= p.price,
                        expected: ['apple', 'cherry'],
                    },
                    {
                        label: 'loose equality',
                        propertyLeft: p => p.category == 'fruit',
                        valueLeft: p => 'fruit' == p.category,
                        expected: ['apple', 'banana'],
                    },
                    {
                        label: 'strict equality',
                        propertyLeft: p => p.category === 'fruit',
                        valueLeft: p => 'fruit' === p.category,
                        expected: ['apple', 'banana'],
                    },
                    {
                        label: 'loose inequality',
                        propertyLeft: p => p.category != 'fruit',
                        valueLeft: p => 'fruit' != p.category,
                        expected: ['cherry', 'date'],
                    },
                    {
                        label: 'strict inequality',
                        propertyLeft: p => p.category !== 'fruit',
                        valueLeft: p => 'fruit' !== p.category,
                        expected: ['cherry', 'date'],
                    },
                ];

            for (const { label, propertyLeft, valueLeft, expected } of cases) {
                it(`${label} agrees with the property on either side`, async () => {
                    const store = await seededProducts();

                    expect(names(await store.products.where(propertyLeft).toArrayAsync()))
                        .toEqual(expected);
                    expect(names(await store.products.where(valueLeft).toArrayAsync()))
                        .toEqual(expected);
                });
            }
        });

        describe('null comparisons', () => {
            // The audit's High finding, executed. `null == p.deletedAt` used to render
            // `? IS NULL` — the tautology `NULL IS NULL` — which returns EVERY row. Nothing
            // errors; the filter simply stops filtering.
            it('finds null rows with the property on the left', async () => {
                const store = await seededProducts();

                expect(names(await store.products.where(p => p.deletedAt == null).toArrayAsync()))
                    .toEqual(['apple', 'banana']);
            });

            it('finds null rows with the property on the right', async () => {
                const store = await seededProducts();

                expect(names(await store.products.where(p => null == p.deletedAt).toArrayAsync()))
                    .toEqual(['apple', 'banana']);
            });

            it('finds non-null rows with the property on the left', async () => {
                const store = await seededProducts();

                expect(names(await store.products.where(p => p.deletedAt != null).toArrayAsync()))
                    .toEqual(['cherry', 'date']);
            });

            it('finds non-null rows with the property on the right', async () => {
                const store = await seededProducts();

                expect(names(await store.products.where(p => null != p.deletedAt).toArrayAsync()))
                    .toEqual(['cherry', 'date']);
            });

            it('does not treat a non-null value as a null test in reversed order', async () => {
                // The control for the sentinel collision: `'fruit' === p.category` once
                // rendered `category IS NULL`, because an absent side and a real null were
                // indistinguishable. That returns rows, so only the VALUES catch it.
                const store = await seededProducts();

                expect(names(await store.products.where(p => 'fruit' === p.category).toArrayAsync()))
                    .toEqual(['apple', 'banana']);
            });
        });

        describe('composite keys', () => {
            const seeded = async () => {
                const store = open(CompositeStore);

                // Every row shares its FIRST key component with another. A predicate built
                // from `idProperties[0]` alone matches more than one of them.
                await store.rows.addAsync(
                    { tenant: 'acme', sku: 'a', quantity: 1, label: 'acme-a' } as any,
                    { tenant: 'acme', sku: 'b', quantity: 2, label: 'acme-b' } as any,
                    { tenant: 'globex', sku: 'a', quantity: 3, label: 'globex-a' } as any,
                );
                await store.saveChangesAsync();

                return store;
            };

            it('stores rows that differ only in one key component', async () => {
                await seeded();

                expect(await open(CompositeStore).rows.countAsync()).toBe(3);
            });

            it('updates only the addressed row', async () => {
                await seeded();

                const editor = open(CompositeStore);
                const target = await editor.rows.firstAsync(r => r.label === 'acme-a');
                target.quantity = 111;
                await editor.saveChangesAsync();

                const rows = await open(CompositeStore).rows.toArrayAsync();

                expect(rows.find(r => r.label === 'acme-a')!.quantity).toBe(111);
                expect(rows.find(r => r.label === 'acme-b')!.quantity).toBe(2);
                expect(rows.find(r => r.label === 'globex-a')!.quantity).toBe(3);
            });

            it('updates two rows sharing a key component in one save', async () => {
                await seeded();

                const editor = open(CompositeStore);
                const all = await editor.rows.toArrayAsync();
                all.find(r => r.label === 'acme-a')!.quantity = 10;
                all.find(r => r.label === 'acme-b')!.quantity = 20;
                await editor.saveChangesAsync();

                const rows = await open(CompositeStore).rows.toArrayAsync();

                expect(rows.find(r => r.label === 'acme-a')!.quantity).toBe(10);
                expect(rows.find(r => r.label === 'acme-b')!.quantity).toBe(20);
                expect(rows.find(r => r.label === 'globex-a')!.quantity).toBe(3);
            });

            it('echoes the addressed row back, not its siblings', async () => {
                // The select-back path. An echo built from one key component returns every
                // row sharing it, and the change tracker merges whatever it is handed.
                await seeded();

                const editor = open(CompositeStore);
                const target = await editor.rows.firstAsync(r => r.label === 'globex-a');
                target.quantity = 999;
                await editor.saveChangesAsync();

                expect(target.quantity).toBe(999);
                expect(target.label).toBe('globex-a');
            });

            it('removes only the addressed row', async () => {
                await seeded();

                const remover = open(CompositeStore);
                await remover.rows.removeAsync(await remover.rows.firstAsync(r => r.label === 'acme-a'));
                await remover.saveChangesAsync();

                const left = await open(CompositeStore).rows.toArrayAsync();

                expect(left.map(r => r.label).sort()).toEqual(['acme-b', 'globex-a']);
            });
        });

        describe('renamed columns', () => {
            it('writes and reads through the storage-side names', async () => {
                const store = open(RenamedStore);

                await store.rows.addAsync({ id: 'r1', label: 'visible', amount: 7 } as any);
                await store.saveChangesAsync();

                const found = await open(RenamedStore).rows.firstAsync();

                expect(found.label).toBe('visible');
                expect(found.amount).toBe(7);
            });

            it('persists an update to a renamed column', async () => {
                const store = open(RenamedStore);
                await store.rows.addAsync({ id: 'r2', label: 'before', amount: 1 } as any);
                await store.saveChangesAsync();

                const editor = open(RenamedStore);
                const target = await editor.rows.firstAsync(r => r.id === 'r2');
                target.label = 'after';
                await editor.saveChangesAsync();

                expect((await open(RenamedStore).rows.firstAsync(r => r.id === 'r2')).label).toBe('after');
            });
        });

        describe('nested JSON values', () => {
            it('round-trips a nested object and an array', async () => {
                const store = open(NestedStore);

                await store.rows.addAsync({
                    id: 'n1',
                    payload: { inner: { value: 'deep', count: 3 } },
                    tags: ['a', 'b'],
                } as any);
                await store.saveChangesAsync();

                const found: any = await open(NestedStore).rows.firstAsync();

                // Both assertions: a JSON column handed back as a raw STRING passes a
                // truthiness check and fails on the first property access.
                expect(typeof found.payload).toBe('object');
                expect(found.payload.inner).toEqual({ value: 'deep', count: 3 });
                expect(found.tags).toEqual(['a', 'b']);
            });

            it('keeps unchanged siblings when one nested value is patched', async () => {
                const store = open(NestedStore);
                await store.rows.addAsync({
                    id: 'n2',
                    payload: { inner: { value: 'before', count: 9 } },
                    tags: [],
                } as any);
                await store.saveChangesAsync();

                const editor = open(NestedStore);
                const target = await editor.rows.firstAsync(r => r.id === 'n2');
                editor.rows.update(target, { payload: { inner: { value: 'after' } } } as any);
                await editor.saveChangesAsync();

                const reread: any = await open(NestedStore).rows.firstAsync(r => r.id === 'n2');

                expect(reread.payload.inner.value).toBe('after');
                // A partial subtree written over the whole column loses this.
                expect(reread.payload.inner.count).toBe(9);
            });

            it('stores an emptied array as empty rather than null', async () => {
                const store = open(NestedStore);
                await store.rows.addAsync({
                    id: 'n3',
                    payload: { inner: { value: 'v', count: 1 } },
                    tags: ['gone'],
                } as any);
                await store.saveChangesAsync();

                const editor = open(NestedStore);
                editor.rows.update(await editor.rows.firstAsync(r => r.id === 'n3'), { tags: [] } as any);
                await editor.saveChangesAsync();

                const reread: any = await open(NestedStore).rows.firstAsync(r => r.id === 'n3');

                expect(Array.isArray(reread.tags)).toBe(true);
                expect(reread.tags).toEqual([]);
            });
        });

        /**
         * Filtering INTO a nested value, as opposed to round-tripping one.
         *
         * The gap these close: a nested subtree is stored as one JSON column named for its
         * root, but the translator rendered the leaf name alone and emitted `"value" = ?` —
         * a column that does not exist. Nothing caught it, because the cases above only ever
         * wrote and read nested values and `sql.test.ts` asserts emitted strings rather than
         * executing them.
         *
         * Every engine here has JSON path operators (SQLite via JSON1, built in since 3.38),
         * so unlike full-text search this is a question each one can answer the same way.
         */
        describe('nested JSON filters', () => {
            const seedNested = async () => {
                const store = open(NestedStore);

                await store.rows.addAsync(
                    { id: 'f1', payload: { inner: { value: 'alpha', count: 3 } }, tags: [] } as any,
                    { id: 'f2', payload: { inner: { value: 'beta', count: 10 } }, tags: [] } as any,
                    { id: 'f3', payload: { inner: { value: 'gamma', count: 9 } }, tags: [] } as any,
                );
                await store.saveChangesAsync();
            };

            it('filters on a nested string', async () => {
                await seedNested();

                const found = await open(NestedStore).rows
                    .where(r => (r as any).payload.inner.value === 'beta')
                    .toArrayAsync();

                expect(found.map((r: any) => r.id)).toEqual(['f2']);
            });

            /**
             * The case a text comparison gets wrong rather than errors on: extracted as
             * text, `'10' > '9'` is false, so `count > 9` silently drops f2.
             */
            it('compares a nested number numerically, not lexicographically', async () => {
                await seedNested();

                const found = await open(NestedStore).rows
                    .where(r => (r as any).payload.inner.count > 9)
                    .toArrayAsync();

                expect(found.map((r: any) => r.id)).toEqual(['f2']);
            });

            it('orders nested numbers numerically', async () => {
                await seedNested();

                const found = await open(NestedStore).rows
                    .where(r => (r as any).payload.inner.count >= 3)
                    .toArrayAsync();

                expect(found.map((r: any) => r.id).sort()).toEqual(['f1', 'f2', 'f3']);
            });

            it('combines a nested filter with a root-column filter', async () => {
                await seedNested();

                const found = await open(NestedStore).rows
                    .where(r => (r as any).payload.inner.count > 5 && (r as any).id === 'f3')
                    .toArrayAsync();

                expect(found.map((r: any) => r.id)).toEqual(['f3']);
            });

            it('matches a nested string by prefix', async () => {
                await seedNested();

                const found = await open(NestedStore).rows
                    .where(r => (r as any).payload.inner.value.startsWith('ga'))
                    .toArrayAsync();

                expect(found.map((r: any) => r.id)).toEqual(['f3']);
            });
        });

        describe('update deltas', () => {
            it('applies an update touching one column', async () => {
                await seededProducts();

                const editor = open(ProductStore);
                const target = await editor.products.firstAsync(p => p.id === 'p1');
                target.price = 99;
                await editor.saveChangesAsync();

                expect((await open(ProductStore).products.firstAsync(p => p.id === 'p1')).price).toBe(99);
                // Untouched columns survive.
                expect((await open(ProductStore).products.firstAsync(p => p.id === 'p1')).name).toBe('apple');
            });

            it('applies two updates whose changed columns differ in one save', async () => {
                // Defect #22's shape: two changed-column groups become two statements, and
                // joining them with ';' is rejected by Postgres and mysql2 alike.
                await seededProducts();

                const editor = open(ProductStore);
                const rows = await editor.products.toArrayAsync();
                rows.find(p => p.id === 'p1')!.price = 11;
                rows.find(p => p.id === 'p2')!.name = 'renamed';
                rows.find(p => p.id === 'p2')!.category = 'changed';
                await editor.saveChangesAsync();

                const after = await open(ProductStore).products.toArrayAsync();

                expect(after.find(p => p.id === 'p1')!.price).toBe(11);
                expect(after.find(p => p.id === 'p2')!.name).toBe('renamed');
                expect(after.find(p => p.id === 'p2')!.category).toBe('changed');
            });

            it('applies removes, updates and adds from one save', async () => {
                await seededProducts();

                const editor = open(ProductStore);
                const rows = await editor.products.toArrayAsync();
                rows.find(p => p.id === 'p1')!.price = 111;
                await editor.products.removeAsync(rows.find(p => p.id === 'p4')!);
                await editor.products.addAsync(
                    { id: 'p5', name: 'elderberry', category: 'fruit', price: 50, deletedAt: null } as any
                );
                await editor.saveChangesAsync();

                const after = await open(ProductStore).products.toArrayAsync();

                expect(after.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3', 'p5']);
                expect(after.find(p => p.id === 'p1')!.price).toBe(111);
            });

            it('sets a column to null', async () => {
                await seededProducts();

                const editor = open(ProductStore);
                const target = await editor.products.firstAsync(p => p.id === 'p3');
                target.deletedAt = null;
                await editor.saveChangesAsync();

                // And the null test finds it afterwards, which is the whole round trip.
                const restored = await open(ProductStore).products
                    .where(p => p.deletedAt == null)
                    .toArrayAsync();

                expect(names(restored)).toEqual(['apple', 'banana', 'cherry']);
            });
        });
    });
}
