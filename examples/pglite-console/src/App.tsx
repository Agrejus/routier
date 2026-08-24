import { useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORIES, Product } from './schemas';
import { DATABASE_NAME, DATA_DIR, openStore, ShopStore } from './store';

const SUPPLIERS = [
    { name: 'Northwind', country: 'US' },
    { name: 'Alpine Foods', country: 'CH' },
    { name: 'Kaido Trading', country: 'JP' },
];

const sample = (index: number) => ({
    name: `Item ${index}`,
    category: CATEGORIES[index % CATEGORIES.length],
    price: Math.round((5 + (index % 17) * 3.25) * 100) / 100,
    tags: index % 2 === 0 ? ['bulk', 'featured'] : ['single'],
    supplier: SUPPLIERS[index % SUPPLIERS.length],
    createdAt: new Date(),
});

export function App() {
    const store = useRef<ShopStore>();
    const [rows, setRows] = useState<Product[]>([]);
    const [startupCount, setStartupCount] = useState<number | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [busy, setBusy] = useState(true);

    const say = useCallback((message: string) => {
        setLog(previous => [...previous, message]);
    }, []);

    const refresh = useCallback(async () => {
        const found = await store.current!.products.sort(p => p.name).toArrayAsync();
        setRows(found);
        return found;
    }, []);

    // The persistence claim. Rows present before this page wrote anything came out of OPFS,
    // written by a previous load.
    useEffect(() => {
        store.current = openStore();

        (async () => {
            const found = await refresh();
            setStartupCount(found.length);
            say(`opened ${DATABASE_NAME} — ${found.length} row(s) already on disk`);
            setBusy(false);
        })().catch(error => {
            say(`failed to open: ${error.message}`);
            setBusy(false);
        });
    }, [refresh, say]);

    const run = (label: string, work: () => Promise<string>) => async () => {
        setBusy(true);
        try {
            const started = performance.now();
            const outcome = await work();
            // Refresh BEFORE logging, so a new log line means the table on screen is already
            // up to date. Logging first makes the log a promise the UI has not kept yet.
            await refresh();
            say(`${label}: ${outcome} (${Math.round(performance.now() - started)} ms)`);
        } catch (error) {
            say(`${label} FAILED: ${(error as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    const seed = run('seed', async () => {
        const next = rows.length;
        await store.current!.products.addAsync(...Array.from({ length: 5 }, (_, i) => sample(next + i)));
        await store.current!.saveChangesAsync();
        return 'added 5';
    });

    const raisePrices = run('update', async () => {
        const all = await store.current!.products.toArrayAsync();
        for (const product of all) {
            product.price = Math.round(product.price * 1.1 * 100) / 100;
        }
        await store.current!.saveChangesAsync();
        return `repriced ${all.length}`;
    });

    /**
     * A filter that reaches INTO a JSONB column, evaluated by PostgreSQL rather than in
     * memory. This is the thing a key-value store in the browser cannot do.
     *
     * The array filter is membership, not a substring test: PostgreSQL evaluates it with `@>`.
     */
    const queryNested = run('query', async () => {
        const swiss = await store.current!.products
            .where(([p, q]) => p.supplier.country === q.code, { code: 'CH' })
            .toArrayAsync();
        const featured = await store.current!.products
            .where(p => p.tags.includes('featured'))
            .toArrayAsync();

        return `supplier.country = CH → ${swiss.length}; tags contains featured → ${featured.length}`;
    });

    const aggregate = run('aggregate', async () => {
        const count = await store.current!.products.countAsync();
        const total = await store.current!.products.sumAsync(p => p.price);
        return `${count} row(s), total ${total.toFixed(2)}`;
    });

    const clear = run('clear', async () => {
        const all = await store.current!.products.toArrayAsync();
        if (all.length > 0) {
            await store.current!.products.removeAsync(...all);
            await store.current!.saveChangesAsync();
        }
        return `removed ${all.length}`;
    });

    return (
        <main>
            <header>
                <h1>PGlite Console</h1>
                <p>
                    PostgreSQL compiled to WebAssembly, in this tab, persisted by the browser.
                    Storage: <code>{DATA_DIR}</code>
                </p>
            </header>

            <section className="banner" data-testid="startup">
                {startupCount === null
                    ? 'opening…'
                    : startupCount === 0
                        ? 'Empty database. Seed some rows, then reload the page — they will still be here.'
                        : `${startupCount} row(s) survived the last page load.`}
            </section>

            <section className="actions">
                <button onClick={seed} disabled={busy} data-testid="seed">Seed 5</button>
                <button onClick={raisePrices} disabled={busy} data-testid="update">Raise prices 10%</button>
                <button onClick={queryNested} disabled={busy} data-testid="query">Query JSONB + array</button>
                <button onClick={aggregate} disabled={busy} data-testid="aggregate">Count + sum</button>
                <button onClick={clear} disabled={busy} data-testid="clear">Clear</button>
                <button onClick={() => location.reload()} data-testid="reload">Reload page</button>
            </section>

            <section className="grid">
                <div>
                    <h2>Rows <span data-testid="count">{rows.length}</span></h2>
                    <table>
                        <thead>
                            <tr><th>Name</th><th>Category</th><th>Price</th><th>Supplier</th><th>Tags</th></tr>
                        </thead>
                        <tbody data-testid="rows">
                            {rows.map(product => (
                                <tr key={product.id}>
                                    <td>{product.name}</td>
                                    <td>{product.category}</td>
                                    <td>{product.price.toFixed(2)}</td>
                                    <td>{product.supplier.name} ({product.supplier.country})</td>
                                    <td>{product.tags.join(', ')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div>
                    <h2>Log</h2>
                    <pre data-testid="log">{log.join('\n')}</pre>
                </div>
            </section>
        </main>
    );
}
