import { useEffect, useRef, useState } from 'react';
import { PERSIST, PLUGIN, START_RATE, START_USERS, UNPROTECTED, uiStore } from './store';
import { simulator } from './simulator';
import { metrics } from './metrics';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { AccountDetail } from './pages/AccountDetail';
import { Transactions } from './pages/Transactions';
import { Market } from './pages/Market';

type Tab = 'dashboard' | 'accounts' | 'transactions' | 'market';

const USERS_SEEDED = 25;
const ACCOUNTS_PER_USER = 3;

export function App() {
    const [tab, setTab] = useState<Tab>('dashboard');
    const [accountId, setAccountId] = useState<string | null>(null);
    const [seeded, setSeeded] = useState(false);
    const [running, setRunning] = useState(false);
    const [userCount, setUserCount] = useState(START_USERS);
    const [rate, setRate] = useState(START_RATE);
    const [snap, setSnap] = useState(metrics.snapshot());
    // Read by the exposed surface above, which is created once and must not close over stale state.
    const seededRef = useRef(false);

    useEffect(() => {
        simulator.seed(uiStore, USERS_SEEDED, ACCOUNTS_PER_USER).then(() => { seededRef.current = true; setSeeded(true); });
        metrics.startFpsMeter();

        /**
         * What a Playwright run reads.
         *
         * Exposed rather than scraped: the metrics bar renders `12.3 ms` and `1,024`, and parsing
         * those back is how a test starts failing on a locale or a rounding change instead of on
         * the thing it is checking.
         */
        (window as unknown as Record<string, unknown>).__financeStress = {
            plugin: PLUGIN,
            persisted: PERSIST,
            protected: UNPROTECTED === false,
            metrics: () => metrics.snapshot(),
            seeded: () => seededRef.current,
        };

        const interval = setInterval(() => {
            metrics.tick();
            setSnap(metrics.snapshot());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const toggleSimulator = async () => {
        if (running) {
            simulator.stop();
            setRunning(false);
            return;
        }

        await simulator.start(userCount, rate);
        setRunning(true);
    };

    const openAccount = (id: string) => {
        setAccountId(id);
        setTab('accounts');
    };

    return (
        <>
            <header>
                <h1>Routier Finance</h1>
                <span className="pill" data-testid="plugin" title={PERSIST ? 'persistent storage' : 'in-memory storage'}>
                    {PLUGIN}{PERSIST ? ' (persisted)' : ''}
                </span>
                <span className="pill" style={{ color: UNPROTECTED ? 'var(--bad)' : 'var(--good)', borderColor: 'currentColor' }} data-testid="protection">
                    {UNPROTECTED ? 'UNPROTECTED' : 'ConcurrencyDbPlugin'}
                </span>
                <nav>
                    <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { setTab('dashboard'); }}>Dashboard</button>
                    <button className={tab === 'accounts' ? 'active' : ''} onClick={() => { setTab('accounts'); setAccountId(null); }}>Accounts</button>
                    <button className={tab === 'transactions' ? 'active' : ''} onClick={() => { setTab('transactions'); }}>Transactions</button>
                    <button className={tab === 'market' ? 'active' : ''} onClick={() => { setTab('market'); }}>Market</button>
                </nav>
                <div className="controls">
                    <label>
                        users
                        <input type="range" min={1} max={50} value={userCount} disabled={running}
                            onChange={e => setUserCount(Number(e.target.value))} />
                        <span className="count">{userCount}</span>
                    </label>
                    <label>
                        tx/s
                        <input type="range" min={5} max={500} step={5} value={rate} disabled={running}
                            onChange={e => setRate(Number(e.target.value))} />
                        <span className="count">{rate}</span>
                    </label>
                    <button className={running ? 'stop' : ''} onClick={toggleSimulator} disabled={!seeded} data-testid="toggle-sim">
                        {running ? 'Stop' : seeded ? 'Start load' : 'Seeding…'}
                    </button>
                </div>
            </header>

            <main>
                {tab === 'dashboard' && <Dashboard onOpenAccount={openAccount} />}
                {tab === 'accounts' && (accountId == null
                    ? <Accounts onOpenAccount={openAccount} />
                    : <AccountDetail accountId={accountId} onBack={() => setAccountId(null)} />)}
                {tab === 'transactions' && <Transactions />}
                {tab === 'market' && <Market />}
            </main>

            <div className="metrics-bar" data-testid="metrics">
                <Metric label="committed tx" value={snap.committedTransactions.toLocaleString()} />
                <Metric label="tx / sec" value={snap.txPerSecond.toFixed(1)} />
                <Metric label="save p50" value={`${snap.saveP50.toFixed(1)} ms`} tone={snap.saveP50 > 50 ? 'warn' : 'good'} />
                <Metric label="save p95" value={`${snap.saveP95.toFixed(1)} ms`} tone={snap.saveP95 > 100 ? 'bad' : snap.saveP95 > 50 ? 'warn' : 'good'} />
                <Metric label="save p99" value={`${snap.saveP99.toFixed(1)} ms`} />
                <Metric label="deliveries / sec" value={snap.deliveriesPerSecond.toFixed(1)} />
                <Metric label="prop p50 / p95" value={snap.propagationSamples > 0 ? `${snap.propagationP50.toFixed(0)} / ${snap.propagationP95.toFixed(0)} ms` : '—'} tone={snap.propagationP95 > 250 ? 'warn' : 'good'} />
                <Metric label="conflicts (retried)" value={snap.concurrencyConflicts.toLocaleString()} tone={snap.concurrencyConflicts > 0 ? 'warn' : 'good'} />
                <Metric label="failed saves" value={String(snap.failedSaves)} tone={snap.failedSaves > 0 ? 'bad' : 'good'} />
                <Metric label="fps" value={String(snap.fps)} tone={snap.fps < 30 ? 'bad' : snap.fps < 50 ? 'warn' : 'good'} />
            </div>
        </>
    );
}

function Metric(props: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
    return (
        <div className="metric" data-metric={props.label}>
            <div className="label">{props.label}</div>
            <div className={`value ${props.tone ?? ''}`}>{props.value}</div>
        </div>
    );
}
