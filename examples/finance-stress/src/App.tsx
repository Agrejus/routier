import { useEffect, useState } from 'react';
import { uiStore } from './store';
import { simulator } from './simulator';
import { metrics } from './metrics';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { AccountDetail } from './pages/AccountDetail';
import { Transactions } from './pages/Transactions';

type Tab = 'dashboard' | 'accounts' | 'transactions';

const USERS_SEEDED = 25;
const ACCOUNTS_PER_USER = 3;

export function App() {
    const [tab, setTab] = useState<Tab>('dashboard');
    const [accountId, setAccountId] = useState<string | null>(null);
    const [seeded, setSeeded] = useState(false);
    const [running, setRunning] = useState(false);
    const [userCount, setUserCount] = useState(10);
    const [rate, setRate] = useState(50);
    const [snap, setSnap] = useState(metrics.snapshot());

    useEffect(() => {
        simulator.seed(uiStore, USERS_SEEDED, ACCOUNTS_PER_USER).then(() => setSeeded(true));
        metrics.startFpsMeter();

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
                <nav>
                    <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { setTab('dashboard'); }}>Dashboard</button>
                    <button className={tab === 'accounts' ? 'active' : ''} onClick={() => { setTab('accounts'); setAccountId(null); }}>Accounts</button>
                    <button className={tab === 'transactions' ? 'active' : ''} onClick={() => { setTab('transactions'); }}>Transactions</button>
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
            </main>

            <div className="metrics-bar" data-testid="metrics">
                <Metric label="committed tx" value={snap.committedTransactions.toLocaleString()} />
                <Metric label="tx / sec" value={snap.txPerSecond.toFixed(1)} />
                <Metric label="save p50" value={`${snap.saveP50.toFixed(1)} ms`} tone={snap.saveP50 > 50 ? 'warn' : 'good'} />
                <Metric label="save p95" value={`${snap.saveP95.toFixed(1)} ms`} tone={snap.saveP95 > 100 ? 'bad' : snap.saveP95 > 50 ? 'warn' : 'good'} />
                <Metric label="save p99" value={`${snap.saveP99.toFixed(1)} ms`} />
                <Metric label="deliveries / sec" value={snap.deliveriesPerSecond.toFixed(1)} />
                <Metric label="conflicts (retried)" value={snap.concurrencyConflicts.toLocaleString()} tone={snap.concurrencyConflicts > 0 ? 'warn' : 'good'} />
                <Metric label="failed saves" value={String(snap.failedSaves)} tone={snap.failedSaves > 0 ? 'bad' : 'good'} />
                <Metric label="fps" value={String(snap.fps)} tone={snap.fps < 30 ? 'bad' : snap.fps < 50 ? 'warn' : 'good'} />
            </div>
        </>
    );
}

function Metric(props: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
    return (
        <div className="metric">
            <div className="label">{props.label}</div>
            <div className={`value ${props.tone ?? ''}`}>{props.value}</div>
        </div>
    );
}
