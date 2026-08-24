import { useEffect, useRef, useState } from 'react';
import { Journey, Visit } from './bench';
import { DbChoice } from './store';
import opsSource from './ops.ts?raw';
import migrateSource from './migrate.ts?raw';

const DBS: DbChoice[] = ['memory', 'localstorage', 'dexie', 'pouchdb', 'sqlite', 'pglite'];
const DATABASES: Record<DbChoice, { name: string; engine: string; shortName: string }> = {
    memory: { name: 'Memory', engine: 'In-process · volatile', shortName: 'Memory' },
    localstorage: { name: 'localStorage', engine: 'Browser · key/value', shortName: 'localStorage' },
    dexie: { name: 'Dexie', engine: 'IndexedDB · structured', shortName: 'Dexie' },
    pouchdb: { name: 'PouchDB', engine: 'IndexedDB · document', shortName: 'PouchDB' },
    sqlite: { name: 'SQLite', engine: 'OPFS · relational', shortName: 'SQLite' },
    pglite: { name: 'PGlite', engine: 'WASM · PostgreSQL', shortName: 'PGlite' },
};

type IconName = 'route' | 'database' | 'chart' | 'code' | 'settings' | 'sparkles' | 'arrow' | 'check' | 'plan';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
    const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
    const paths: Record<IconName, React.ReactNode> = {
        route: <><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h2.5a2.5 2.5 0 0 0 0-5h-1a2.5 2.5 0 0 1 0-5H16"/></>,
        database: <><ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 11v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></>,
        chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
        code: <><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/></>,
        settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
        sparkles: <><path d="m12 3 1.1 3.2L16 7.5l-2.9 1.3L12 12l-1.1-3.2L8 7.5l2.9-1.3L12 3ZM5.5 13l.8 2.2 2.2.8-2.2.8L5.5 19l-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM18.5 12l.7 2 1.8.7-1.8.8-.7 2-.7-2-1.8-.8 1.8-.7.7-2Z"/></>,
        arrow: <><path d="M5 12h14M15 8l4 4-4 4"/></>,
        check: <path d="m5 12 4 4L19 6"/>,
        plan: <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    };
    return <svg {...common}>{paths[name]}</svg>;
}

type BenchmarkResult = { db: DbChoice; visit?: Visit; error?: string };

declare global {
    interface Window {
        __JOURNEY__?: { current: DbChoice | null; visits: Visit[] } | { error: string };
        __BENCHMARK__?: BenchmarkResult[];
    }
}

function formatMs(ms: number) {
    return `${ms.toLocaleString(undefined, { maximumFractionDigits: 1 })} ms`;
}

function totalTime(visit: Visit) {
    return visit.arrival.ms + visit.timings.reduce((sum, timing) => sum + timing.ms, 0);
}

function BenchmarkView({ initialCount, disabledOps }: { initialCount: number; disabledOps: string[] }) {
    const [recordCount, setRecordCount] = useState(Math.min(initialCount, 10000));
    const [results, setResults] = useState<BenchmarkResult[]>([]);
    const [status, setStatus] = useState(`Ready to benchmark all ${DBS.length} storage engines`);
    const [busy, setBusy] = useState(false);

    const runBenchmark = async () => {
        setBusy(true);
        setResults([]);
        const completed: BenchmarkResult[] = [];
        for (const db of DBS) {
            setStatus(`Preparing ${DATABASES[db].name}…`);
            const benchmarkJourney = new Journey(recordCount, disabledOps);
            try {
                const visit = await benchmarkJourney.start(db, message => setStatus(`${DATABASES[db].name} · ${message}`));
                completed.push({ db, visit });
            } catch (error) {
                completed.push({ db, error: error instanceof Error ? error.message : String(error) });
            } finally {
                // Each run gets a unique database. Remove it immediately so repeated SQLite
                // benchmarks do not consume every slot in the finite OPFS SAH handle pool.
                await benchmarkJourney.destroyAsync().catch(error => console.warn('Benchmark cleanup failed', error));
            }
            setResults([...completed]);
            window.__BENCHMARK__ = [...completed];
        }
        setStatus('Benchmark suite completed');
        setBusy(false);
    };

    const successful = results.filter((result): result is BenchmarkResult & { visit: Visit } => result.visit != null);
    const firstVisit = successful[0]?.visit;
    const totals = successful.map(result => totalTime(result.visit));
    const fastestTotal = totals.length ? Math.min(...totals) : 0;
    const slowestTotal = totals.length ? Math.max(...totals) : 1;
    const fastestEngine = successful.find(result => totalTime(result.visit) === fastestTotal);

    return (
        <>
            <section className="page-header benchmark-header">
                <div>
                    <p className="eyebrow">Cross-plugin performance suite</p>
                    <h1>Every engine.<br/>One workload.</h1>
                    <p className="subtitle">Run an identical deterministic dataset and query suite against every Routier storage plugin. Compare ingestion, reads, filters, aggregates, and writes side by side.</p>
                </div>
                <div className="benchmark-run-card">
                    <div className="run-control">
                        <label htmlFor="record-count">Dataset size</label>
                        <select id="record-count" value={recordCount} disabled={busy} onChange={event => setRecordCount(Number(event.target.value))}>
                            <option value={1000}>1,000 orders</option>
                            <option value={5000}>5,000 orders</option>
                            <option value={10000}>10,000 orders</option>
                            <option value={15000}>15,000 orders</option>
                        </select>
                    </div>
                    <button className="run-benchmark" disabled={busy} onClick={runBenchmark}>
                        {busy ? <><span className="button-spinner"/>Running suite…</> : <><Icon name="chart" size={16}/>Run all benchmarks</>}
                    </button>
                </div>
            </section>

            <section className="benchmark-overview panel">
                <div className="suite-heading">
                    <div>
                        <span className="suite-kicker">Benchmark matrix</span>
                        <h2>Storage engines</h2>
                    </div>
                    <div className={`suite-status${busy ? ' running' : ''}`}><i className={busy ? 'pulse-dot' : 'live-dot'}/>{status}</div>
                </div>
                <div className="engine-status-grid">
                    {DBS.map((db, index) => {
                        const result = results.find(item => item.db === db);
                        const total = result?.visit ? totalTime(result.visit) : null;
                        const isRunning = busy && results.length === index;
                        return (
                            <div className={`engine-status${result?.error ? ' failed' : ''}${result?.visit ? ' complete' : ''}`} key={db}>
                                <div className="engine-status-top">
                                    <span className="db-icon"><Icon name="database" size={17}/></span>
                                    <span className={`engine-state${isRunning ? ' testing' : ''}`}>{isRunning ? 'Testing' : result?.error ? 'Failed' : result?.visit ? 'Complete' : 'Queued'}</span>
                                </div>
                                <strong>{DATABASES[db].name}</strong>
                                <small>{DATABASES[db].engine}</small>
                                {total != null && <div className="engine-total"><span>Total runtime</span><b>{formatMs(total)}</b></div>}
                                {result?.error && <div className="engine-error" title={result.error}><strong>Unable to complete</strong><span>{result.error}</span></div>}
                            </div>
                        );
                    })}
                </div>
            </section>

            {successful.length > 0 && (
                <>
                    <section className="section benchmark-kpis">
                        <div className="kpi-card"><span>Fastest overall</span><strong>{fastestEngine ? DATABASES[fastestEngine.db].name : '—'}</strong><small>{formatMs(fastestTotal)} total runtime</small></div>
                        <div className="kpi-card"><span>Engines completed</span><strong>{successful.length}<em> / {DBS.length}</em></strong><small>{results.filter(result => result.error).length ? `${results.filter(result => result.error).length} engine failed` : 'All systems healthy'}</small></div>
                        <div className="kpi-card"><span>Records processed</span><strong>{(successful.length * recordCount).toLocaleString()}</strong><small>Across completed engines</small></div>
                        <div className="kpi-card"><span>Operations measured</span><strong>{firstVisit?.timings.length ?? 0}</strong><small>Per storage engine</small></div>
                    </section>

                    <section className="section" aria-labelledby="runtime-title">
                        <div className="section-heading"><div><h2 id="runtime-title">Total runtime comparison</h2><p>Combined ingestion and query-suite execution time.</p></div><span className="section-tag">LOWER IS BETTER</span></div>
                        <div className="panel runtime-chart">
                            {successful.map(result => {
                                const total = totalTime(result.visit);
                                const width = Math.max(4, (total / slowestTotal) * 100);
                                return (
                                    <div className="runtime-row" key={result.db}>
                                        <span className="runtime-label">{DATABASES[result.db].name}</span>
                                        <div className="runtime-track"><div className={`runtime-bar${total === fastestTotal ? ' best' : ''}`} style={{ width: `${width}%` }}/></div>
                                        <strong>{formatMs(total)}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="section" aria-labelledby="breakdown-title">
                        <div className="section-heading"><div><h2 id="breakdown-title">Operation breakdown</h2><p>Detailed timings for each stage of the standardized workload.</p></div><span className="section-tag">WALL-CLOCK TIME</span></div>
                        <div className="panel results-wrap">
                            <table className="results-table benchmark-table">
                                <thead><tr><th>Operation</th>{successful.map(result => <th key={result.db}>{DATABASES[result.db].shortName}</th>)}</tr></thead>
                                <tbody>
                                    <tr>
                                        <td><span className="arrival-label" title="Opening the engine and answering one statement on an empty database. Paid once per database, so it is not in the totals.">Cold start</span></td>
                                        {successful.map(result => {
                                            const fastest = Math.min(...successful.map(item => item.visit.coldStart.ms));
                                            return <td className={`metric${result.visit.coldStart.ms === fastest && successful.length > 1 ? ' fastest' : ''}`} key={result.db}>{formatMs(result.visit.coldStart.ms)}</td>;
                                        })}
                                    </tr>
                                    <tr>
                                        <td><span className="arrival-label">Seed dataset</span></td>
                                        {successful.map(result => {
                                            const fastest = Math.min(...successful.map(item => item.visit.arrival.ms));
                                            return <td className={`metric${result.visit.arrival.ms === fastest && successful.length > 1 ? ' fastest' : ''}`} key={result.db}>{formatMs(result.visit.arrival.ms)}</td>;
                                        })}
                                    </tr>
                                    {firstVisit?.timings.map((timing, row) => {
                                        const values = successful.map(result => result.visit.timings[row]?.ms).filter((value): value is number => value != null);
                                        const fastest = Math.min(...values);
                                        return <tr key={timing.step}><td>{timing.step}</td>{successful.map(result => {
                                            const value = result.visit.timings[row];
                                            return <td className={`metric${value?.ms === fastest && successful.length > 1 ? ' fastest' : ''}`} key={result.db} title={value?.note}>{value ? formatMs(value.ms) : '—'}</td>;
                                        })}</tr>;
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            {results.length === 0 && !busy && (
                <section className="benchmark-empty">
                    <div className="empty-visual"><Icon name="chart" size={25}/><span/><span/><span/></div>
                    <h2>Ready when you are</h2>
                    <p>Choose a dataset size and run the suite to generate a full cross-plugin comparison.</p>
                </section>
            )}
        </>
    );
}

type AppPage = 'migration' | 'benchmark' | 'inspector' | 'configuration';
type LabConfig = { defaultCount: number; disabledOps: string[]; landingPage: 'migration' | 'benchmark' };

const DEFAULT_CONFIG: LabConfig = { defaultCount: 10000, disabledOps: [], landingPage: 'migration' };
const OP_OPTIONS = ['Count', 'Read', 'Filter', 'Page', 'Sum', 'Find', 'Update'];
const QUERIES = [
    {
        name: 'Pending orders in EU', type: 'Filter', method: 'where · toArrayAsync',
        description: 'Compound equality predicate using bound parameters for status and region.',
        code: `.where(\n  ([order, params]) =>\n    order.status === params.status &&\n    order.region === params.region,\n  { status: 'pending', region: 'eu' }\n)\n.toArrayAsync()`,
        params: [['status', 'pending'], ['region', 'eu']],
    },
    {
        name: 'Newest orders page', type: 'Pagination', method: 'sortDescending · skip · take',
        description: 'Sorts orders by creation time and returns a stable 25-record page.',
        code: `.sortDescending(order => order.createdAt)\n.skip(1000)\n.take(25)\n.toArrayAsync()`,
        params: [['skip', '1,000'], ['take', '25']],
    },
    {
        name: 'Paid order revenue', type: 'Aggregate', method: 'where · sumAsync',
        description: 'Pushes a status predicate down before aggregating the order total.',
        code: `.where(\n  ([order, params]) => order.status === params.status,\n  { status: 'paid' }\n)\n.sumAsync(order => order.total)`,
        params: [['status', 'paid'], ['field', 'total']],
    },
    {
        name: 'Customer email lookup', type: 'Point lookup', method: 'firstOrUndefinedAsync',
        description: 'Returns the first matching order for a parameterized customer email.',
        code: `.firstOrUndefinedAsync(\n  ([order, params]) => order.email === params.email,\n  { email: 'customer@example.com' }\n)`,
        params: [['email', 'customer@example.com']],
    },
];

function loadConfig(): LabConfig {
    try {
        const stored = localStorage.getItem('routier-lab-config');
        return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
        return DEFAULT_CONFIG;
    }
}

function QueryInspector({ visits }: { visits: Visit[] }) {
    const [selectedQuery, setSelectedQuery] = useState(0);
    const [selectedVisit, setSelectedVisit] = useState(Math.max(0, visits.length - 1));
    const [copied, setCopied] = useState(false);
    const query = QUERIES[selectedQuery];
    const planVisit = selectedQuery === 0 ? visits[selectedVisit] : undefined;

    const copyQuery = async () => {
        await navigator.clipboard?.writeText(`store.orders${query.code}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
    };

    return (
        <>
            <section className="page-header inspector-header">
                <div><p className="eyebrow">Expression pipeline</p><h1>Query inspector.</h1><p className="subtitle">See how Routier translates one type-safe expression into a portable execution plan for every storage engine.</p></div>
                <div className="inspector-badge"><Icon name="code" size={18}/><div><strong>4 queries</strong><span>7 operations covered</span></div></div>
            </section>

            <div className="inspector-layout">
                <aside className="query-list panel">
                    <div className="query-list-title">Saved queries <span>{QUERIES.length}</span></div>
                    {QUERIES.map((item, index) => <button className={`query-list-item${selectedQuery === index ? ' active' : ''}`} key={item.name} onClick={() => setSelectedQuery(index)}><span className="query-type">{item.type}</span><strong>{item.name}</strong><small>{item.method}</small></button>)}
                </aside>

                <div className="query-workspace">
                    <section className="panel query-editor">
                        <div className="editor-header"><div><span className="query-type">{query.type}</span><h2>{query.name}</h2><p>{query.description}</p></div><button className="copy-button" onClick={copyQuery}>{copied ? <><Icon name="check" size={13}/>Copied</> : <><Icon name="code" size={13}/>Copy query</>}</button></div>
                        <div className="code-editor"><div className="line-numbers">{Array.from({ length: query.code.split('\n').length + 1 }, (_, index) => <span key={index}>{index + 1}</span>)}</div><pre><span className="code-prefix">store.orders</span>{query.code}</pre></div>
                        <div className="parameter-strip"><span>Bound parameters</span>{query.params.map(([key, value]) => <div className="parameter" key={key}><b>{key}</b><code>{value}</code></div>)}</div>
                    </section>

                    <section className="pipeline panel">
                        <div className="mini-panel-header"><div><h2>Execution pipeline</h2><p>Portable query compilation</p></div><span>Routier Core</span></div>
                        <div className="pipeline-steps">
                            {['Parse expression', 'Normalize AST', 'Analyze pushdown', 'Execute plugin'].map((step, index) => <div className="pipeline-step" key={step}><i>{index + 1}</i><span>{step}</span>{index < 3 && <Icon name="arrow" size={13}/>}</div>)}
                        </div>
                    </section>

                    <section className="panel plan-viewer">
                        <div className="mini-panel-header">
                            <div><h2>Captured execution plan</h2><p>Live output from the migration lab</p></div>
                            {selectedQuery === 0 && visits.length > 0 && <select value={Math.min(selectedVisit, visits.length - 1)} onChange={event => setSelectedVisit(Number(event.target.value))}>{visits.map((visit, index) => <option value={index} key={`${visit.db}-${index}`}>{DATABASES[visit.db].name}</option>)}</select>}
                        </div>
                        {planVisit ? <pre className="code plan-code">{JSON.stringify(planVisit.explanation, null, 2)}</pre> : <div className="plan-empty"><span className="summary-icon"><Icon name="plan" size={16}/></span><div><strong>{selectedQuery === 0 ? 'No execution plan captured yet' : 'Plan capture is available for the EU filter'}</strong><p>{selectedQuery === 0 ? 'Run an engine in the Migration Lab, then return here to inspect its real pushdown analysis.' : 'Select “Pending orders in EU” to inspect live plugin output, or review this query’s portable expression pipeline above.'}</p></div></div>}
                    </section>

                    <section className="support-matrix panel">
                        <div className="mini-panel-header"><div><h2>Plugin compatibility</h2><p>This query is portable across every configured engine.</p></div><span className="compatibility-pill"><Icon name="check" size={12}/>{DBS.length} of {DBS.length} supported</span></div>
                        <div className="compatibility-grid">{DBS.map(db => <div key={db}><span className="db-icon"><Icon name="database" size={14}/></span><strong>{DATABASES[db].name}</strong><small><Icon name="check" size={11}/>Supported</small></div>)}</div>
                    </section>
                </div>
            </div>
        </>
    );
}

function Configuration({ config, onChange }: { config: LabConfig; onChange: (config: LabConfig) => void }) {
    const [draft, setDraft] = useState(config);
    const [saved, setSaved] = useState(false);

    const toggleOperation = (operation: string) => setDraft(current => ({ ...current, disabledOps: current.disabledOps.includes(operation) ? current.disabledOps.filter(item => item !== operation) : [...current.disabledOps, operation] }));
    const save = () => {
        localStorage.setItem('routier-lab-config', JSON.stringify(draft));
        onChange(draft);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
    };
    const apply = () => {
        localStorage.setItem('routier-lab-config', JSON.stringify(draft));
        const params = new URLSearchParams();
        params.set('n', String(draft.defaultCount));
        if (draft.disabledOps.length) params.set('skip', draft.disabledOps.join(','));
        window.location.assign(`${window.location.pathname}?${params}#${draft.landingPage === 'benchmark' ? 'benchmark' : ''}`);
    };
    const reset = () => setDraft(DEFAULT_CONFIG);

    return (
        <>
            <section className="page-header config-header"><div><p className="eyebrow">Workspace preferences</p><h1>Configuration.</h1><p className="subtitle">Tune the dataset and workload used throughout the migration lab and benchmark suite.</p></div><div className="config-actions"><button className="secondary-button" onClick={reset}>Restore defaults</button><button className="save-button" onClick={save}>{saved ? <><Icon name="check" size={14}/>Saved</> : 'Save preferences'}</button></div></section>

            <div className="config-layout">
                <div>
                    <section className="settings-panel panel">
                        <div className="settings-title"><span className="settings-icon"><Icon name="database" size={17}/></span><div><h2>Dataset</h2><p>Default data volume used for new runs.</p></div></div>
                        <div className="setting-row"><div><label htmlFor="default-count">Order records</label><p>Records are generated from a seeded PRNG for repeatable results.</p></div><select id="default-count" value={draft.defaultCount} onChange={event => setDraft({ ...draft, defaultCount: Number(event.target.value) })}><option value={1000}>1,000</option><option value={5000}>5,000</option><option value={10000}>10,000</option><option value={15000}>15,000</option><option value={25000}>25,000</option></select></div>
                        {draft.defaultCount > 15000 && <div className="config-warning"><span>!</span><p><strong>localStorage quota warning</strong>25,000 orders may exceed the browser's typical 5 MB storage quota.</p></div>}
                    </section>

                    <section className="settings-panel panel">
                        <div className="settings-title"><span className="settings-icon purple"><Icon name="chart" size={17}/></span><div><h2>Benchmark workload</h2><p>Choose which operations are included in migration runs.</p></div></div>
                        <div className="operation-grid">{OP_OPTIONS.map(operation => { const enabled = !draft.disabledOps.includes(operation); return <button className={`operation-toggle${enabled ? ' enabled' : ''}`} key={operation} onClick={() => toggleOperation(operation)}><span>{enabled && <Icon name="check" size={11}/>}</span><div><strong>{operation}</strong><small>{enabled ? 'Included' : 'Skipped'}</small></div></button>; })}</div>
                    </section>

                    <section className="settings-panel panel">
                        <div className="settings-title"><span className="settings-icon"><Icon name="route" size={17}/></span><div><h2>Startup</h2><p>Select the first workspace shown when opening Routier Lab.</p></div></div>
                        <div className="segmented-control"><button className={draft.landingPage === 'migration' ? 'active' : ''} onClick={() => setDraft({ ...draft, landingPage: 'migration' })}><Icon name="database" size={14}/>Migration lab</button><button className={draft.landingPage === 'benchmark' ? 'active' : ''} onClick={() => setDraft({ ...draft, landingPage: 'benchmark' })}><Icon name="chart" size={14}/>Benchmarks</button></div>
                    </section>
                </div>

                <aside className="config-summary panel">
                    <span className="suite-kicker">Active profile</span><h2>Local development</h2><p>Preferences are stored in this browser and never leave your device.</p>
                    <div className="config-summary-list"><div><span>Dataset</span><strong>{draft.defaultCount.toLocaleString()} orders</strong></div><div><span>Operations</span><strong>{OP_OPTIONS.length - draft.disabledOps.length} of {OP_OPTIONS.length}</strong></div><div><span>Storage engines</span><strong>{DBS.length} enabled</strong></div><div><span>Execution</span><strong>Client-side</strong></div></div>
                    <button className="apply-button" onClick={apply}>Apply &amp; start new run <Icon name="arrow" size={14}/></button><small>Applying starts a clean workspace with these settings.</small>
                </aside>
            </div>
        </>
    );
}

export function App() {
    const params = new URLSearchParams(window.location.search);
    const [config, setConfig] = useState(loadConfig);
    const count = Number(params.get('n') ?? config.defaultCount);
    const journey = useRef<Journey | null>(null);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState<AppPage>(() => {
        const hash = window.location.hash.slice(1) as AppPage;
        return ['migration', 'benchmark', 'inspector', 'configuration'].includes(hash) ? hash : config.landingPage;
    });
    const autorun = useRef(false);

    const current = journey.current?.current ?? null;
    const visited = new Set(visits.map(visit => visit.db));

    async function step(action: (activeJourney: Journey) => Promise<Visit>) {
        setBusy(true);
        try {
            journey.current ??= new Journey(count, params.has('skip') ? params.get('skip')!.split(',') : config.disabledOps);
            const visit = await action(journey.current);
            setVisits(previous => {
                const next = [...previous, visit];
                window.__JOURNEY__ = { current: journey.current!.current, visits: next };
                return next;
            });
            setStatus('done');
        } catch (error) {
            setStatus(`error: ${String(error)}`);
            window.__JOURNEY__ = { error: String(error) };
        } finally {
            setBusy(false);
        }
    }

    const start = (db: DbChoice) => step(activeJourney => activeJourney.start(db, setStatus));
    const migrateTo = (db: DbChoice) => step(activeJourney => activeJourney.migrateTo(db, setStatus));

    useEffect(() => {
        const path = params.get('path')?.split(',').filter((db): db is DbChoice => DBS.includes(db as DbChoice));
        if (!path?.length || autorun.current) return;
        autorun.current = true;
        (async () => {
            await start(path[0]);
            for (const db of path.slice(1)) await migrateTo(db);
        })();
    }, []);

    const hasError = status.startsWith('error:');
    const statusMessage = status === 'done'
        ? 'Benchmark completed successfully'
        : status || 'Ready to initialize migration workspace';
    const reset = () => window.location.assign(window.location.pathname);
    const navigate = (nextPage: AppPage) => {
        setPage(nextPage);
        window.location.hash = nextPage;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="brand">
                    <div className="brand-mark"><img src={`${import.meta.env.BASE_URL}routier.svg`} alt="" /></div>
                    <div className="brand-name">Routier <span>/ Lab</span></div>
                </div>
                <div className="breadcrumb"><span>Examples</span><span>/</span><strong>{{ migration: 'Migration Console', benchmark: 'Benchmark Suite', inspector: 'Query Inspector', configuration: 'Configuration' }[page]}</strong></div>
                <div className="topbar-actions">
                    <a className="docs-link" href="https://routier.dev" target="_blank" rel="noreferrer">Documentation</a>
                    <div className="environment"><i className="live-dot"/><span>Browser runtime</span></div>
                </div>
            </header>

            <div className="layout">
                <aside className="sidebar">
                    <p className="nav-label">Workspace</p>
                    <button className={`nav-item${page === 'migration' ? ' active' : ''}`} onClick={() => navigate('migration')}><Icon name="database"/>Migration lab</button>
                    <button className={`nav-item${page === 'benchmark' ? ' active' : ''}`} onClick={() => navigate('benchmark')}><Icon name="chart"/>Benchmarks</button>
                    <button className={`nav-item${page === 'inspector' ? ' active' : ''}`} onClick={() => navigate('inspector')}><Icon name="code"/>Query inspector</button>
                    <button className={`nav-item${page === 'configuration' ? ' active' : ''}`} onClick={() => navigate('configuration')}><Icon name="settings"/>Configuration</button>
                    <div className="sidebar-note">
                        <Icon name="sparkles" size={18}/>
                        <strong>Portable by design</strong>
                        <p>One typed data layer. {DBS.length} storage engines. No application code changes.</p>
                    </div>
                </aside>

                <main className="content">
                    {page === 'migration' ? <>
                    <section className="page-header">
                        <div>
                            <p className="eyebrow">Storage portability benchmark</p>
                            <h1>Same application.<br/>Any database.</h1>
                            <p className="subtitle">Seed, migrate, and benchmark an identical order workload across {DBS.length} browser storage engines—without changing a single query.</p>
                        </div>
                        <div className="run-meta" aria-label="Benchmark configuration">
                            <span className="run-meta-label">Dataset</span><span className="run-meta-value">{count.toLocaleString()} orders</span>
                            <span className="run-meta-label">Engines</span><span className="run-meta-value">{String(DBS.length).padStart(2, '0')} available</span>
                            <span className="run-meta-label">Mode</span><span className="run-meta-value">client-side</span>
                        </div>
                    </section>

                    <section className="panel" aria-labelledby="workflow-title">
                        <div className="panel-header">
                            <div className="panel-title-wrap">
                                <span className="step-number">{current == null ? '01' : '02'}</span>
                                <div>
                                    <h2 className="panel-title" id="workflow-title">{current == null ? 'Choose a source database' : 'Select the next destination'}</h2>
                                    <p className="panel-description">{current == null ? `Initialize the workspace with ${count.toLocaleString()} deterministic order records.` : `Copy every record from ${DATABASES[current].name}, then execute the same query suite.`}</p>
                                </div>
                            </div>
                            {current != null && <div className="current-pill"><i className="live-dot"/>Active · {DATABASES[current].name}</div>}
                        </div>

                        <div className="database-grid">
                            {DBS.map(db => {
                                const isVisited = visited.has(db);
                                const isAvailable = current == null || !isVisited;
                                const action = current == null ? `Start on ${DATABASES[db].name}` : `Migrate to ${DATABASES[db].name}`;
                                return (
                                    <button
                                        className={`db-card${isVisited ? ' visited' : ''}`}
                                        key={db}
                                        disabled={busy || !isAvailable}
                                        onClick={() => current == null ? start(db) : migrateTo(db)}
                                        aria-label={isVisited ? `${DATABASES[db].name} completed` : action}
                                    >
                                        <span className="db-icon"><Icon name="database" size={18}/></span>
                                        <span className="db-name">{DATABASES[db].name}</span>
                                        <span className="db-engine">{DATABASES[db].engine}</span>
                                        <span className="db-action">{isVisited ? <><Icon name="check" size={12}/>Completed</> : <>{action}<Icon name="arrow" size={12}/></>}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={`status-bar${hasError ? ' error' : ''}`} data-status={busy ? 'running' : status}>
                            <span className={`status-icon${busy ? ' running' : ''}`}>{!busy && <Icon name={hasError ? 'plan' : 'check'} size={14}/>}</span>
                            <span>{statusMessage}</span>
                            <span className="status-spacer"/>
                            {visits.length > 0 && <button className="reset-button" onClick={reset}>New run</button>}
                            {visits.length === 0 && <span className="status-hint">All processing happens locally in your browser</span>}
                        </div>
                    </section>

                    {visits.length > 0 && (
                        <section className="section" aria-labelledby="results-title">
                            <div className="section-heading">
                                <div><h2 id="results-title">Benchmark results</h2><p>Lower execution time indicates better performance for this workload.</p></div>
                                <span className="section-tag">{visits.length}/{DBS.length} engines tested</span>
                            </div>
                            <div className="panel results-wrap">
                                <table className="results-table">
                                    <thead><tr><th>Operation</th>{visits.map((visit, index) => <th key={`${visit.db}-${index}`}>{DATABASES[visit.db].shortName}</th>)}</tr></thead>
                                    <tbody>
                                        <tr>
                                            <td><span className="arrival-label" title="Opening the engine and answering one statement on an empty database.">Cold start</span></td>
                                            {visits.map((visit, index) => <td className="metric" key={`${visit.db}-${index}`}>{formatMs(visit.coldStart.ms)}</td>)}
                                        </tr>
                                        <tr>
                                            <td><span className="arrival-label">Data arrival</span></td>
                                            {visits.map((visit, index) => <td className="metric" key={`${visit.db}-${index}`} title={visit.arrival.note}>{formatMs(visit.arrival.ms)}</td>)}
                                        </tr>
                                        {visits[0].timings.map((timing, row) => {
                                            const rowValues = visits.map(visit => visit.timings[row]?.ms).filter((value): value is number => value != null);
                                            const fastest = Math.min(...rowValues);
                                            return (
                                                <tr key={timing.step}>
                                                    <td>{timing.step}</td>
                                                    {visits.map((visit, index) => {
                                                        const result = visit.timings[row];
                                                        return <td key={`${visit.db}-${index}`} className={`metric${result?.ms === fastest && visits.length > 1 ? ' fastest' : ''}`} title={result?.note}>{result ? formatMs(result.ms) : '—'}</td>;
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {visits.length > 0 && (
                        <section className="section" aria-labelledby="plans-title">
                            <div className="section-heading"><div><h2 id="plans-title">Query plans</h2><p>Inspect pushdown analysis and the expression tree executed by each plugin.</p></div></div>
                            <div className="insight-grid">
                                {visits.map((visit, index) => (
                                    <details className="insight" key={`${visit.db}-${index}`}>
                                        <summary>
                                            <span className="summary-icon"><Icon name="plan" size={14}/></span>
                                            <span className="summary-copy">EU order filter · {DATABASES[visit.db].name}<small>Execution plan</small></span>
                                            <span className="chevron">⌄</span>
                                        </summary>
                                        <pre className="code">{JSON.stringify(visit.explanation, null, 2)}</pre>
                                    </details>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="section" aria-labelledby="source-title">
                        <div className="section-heading"><div><h2 id="source-title">Implementation</h2><p>The exact TypeScript used for every engine in this benchmark.</p></div></div>
                        <div className="source-grid">
                            <details className="source-card"><summary><span className="file-dot"/>src/ops.ts <span className="chevron">⌄</span></summary><pre className="code">{opsSource}</pre></details>
                            <details className="source-card"><summary><span className="file-dot"/>src/migrate.ts <span className="chevron">⌄</span></summary><pre className="code">{migrateSource}</pre></details>
                        </div>
                    </section>
                    </> : page === 'benchmark'
                        ? <BenchmarkView initialCount={count} disabledOps={config.disabledOps}/>
                        : page === 'inspector'
                            ? <QueryInspector visits={visits}/>
                            : <Configuration config={config} onChange={setConfig}/>} 
                </main>
            </div>
        </div>
    );
}
