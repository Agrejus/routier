import { useEffect, useRef, useState } from 'react';
import { BenchResult, migrate, runBench, Timing } from './bench';
import { DbChoice } from './store';

const DBS: DbChoice[] = ['memory', 'dexie', 'pouchdb', 'sqlite'];
const LABELS: Record<DbChoice, string> = {
    memory: 'Memory',
    dexie: 'Dexie (IndexedDB)',
    pouchdb: 'PouchDB (IndexedDB)',
    sqlite: 'SQLite (OPFS)',
};

declare global {
    interface Window {
        __BENCH__?: BenchResult | { error: string };
        __BENCH_RUNS__?: BenchResult[] | { error: string };
        __MIGRATE__?: Timing[] | { error: string };
    }
}

export function App() {
    const params = new URLSearchParams(window.location.search);
    const initialDb = (params.get('db') as DbChoice) ?? 'dexie';
    const count = Number(params.get('n') ?? 25000);
    const autorun = params.has('run');

    const [db, setDb] = useState<DbChoice>(DBS.includes(initialDb) ? initialDb : 'dexie');
    const [status, setStatus] = useState('idle');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<BenchResult | null>(null);
    const started = useRef(false);

    async function run(choice: DbChoice) {
        const runs = Number(params.get('runs') ?? 1);
        setRunning(true);
        setResult(null);
        window.__BENCH__ = undefined;
        window.__BENCH_RUNS__ = undefined;
        try {
            const all: BenchResult[] = [];
            for (let i = 0; i < runs; i++) {
                const r = await runBench(choice, count, m => setStatus(`run ${i + 1}/${runs}: ${m}`));
                all.push(r);
                setResult(r);
            }
            setStatus('done');
            window.__BENCH__ = all[all.length - 1];
            window.__BENCH_RUNS__ = all;
        } catch (error) {
            setStatus(`error: ${String(error)}`);
            window.__BENCH__ = { error: String(error) };
        } finally {
            setRunning(false);
        }
    }

    async function runMigrate(from: DbChoice, to: DbChoice) {
        setRunning(true);
        window.__MIGRATE__ = undefined;
        try {
            const timings = await migrate(from, to, count, setStatus);
            setStatus(`migration done: ${timings.map(t => `${t.step} = ${t.ms}ms`).join(', ')}`);
            window.__MIGRATE__ = timings;
        } catch (error) {
            setStatus(`error: ${String(error)}`);
            window.__MIGRATE__ = { error: String(error) };
        } finally {
            setRunning(false);
        }
    }

    useEffect(() => {
        if (autorun && !started.current) {
            started.current = true;
            const from = params.get('from') as DbChoice;
            const to = params.get('to') as DbChoice;
            if (from && to) {
                runMigrate(from, to);
            } else {
                run(db);
            }
        }
    }, []);

    return (
        <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
            <h1 style={{ fontSize: '1.4rem' }}>Same app, different database</h1>
            <p>
                One Routier store, {count.toLocaleString()} seeded orders, the same eight operations.
                The only thing that changes between columns is the plugin passed to the store.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {DBS.map(choice => (
                    <button
                        key={choice}
                        disabled={running}
                        onClick={() => { setDb(choice); run(choice); }}
                        style={{ padding: '8px 14px', fontWeight: choice === db ? 700 : 400 }}
                    >
                        {LABELS[choice]}
                    </button>
                ))}
            </div>
            <p data-status={running ? 'running' : status === 'done' ? 'done' : status}>
                <strong>{LABELS[db]}</strong>: {status}
            </p>
            {result && (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={cell}>Operation</th>
                            <th style={{ ...cell, textAlign: 'right' }}>Time (ms)</th>
                            <th style={cell}>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {result.timings.map(t => (
                            <tr key={t.step}>
                                <td style={cell}>{t.step}</td>
                                <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {t.ms.toLocaleString()}
                                </td>
                                <td style={cell}>{t.note ?? ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </main>
    );
}

const cell: React.CSSProperties = {
    border: '1px solid #ccc',
    padding: '6px 10px',
    textAlign: 'left',
};
