import { memo, useEffect, useRef, useState } from 'react';
import { uiStore } from '../store';
import { Instrument } from '../schemas';
import { marketFeed } from '../marketFeed';
import { metrics } from '../metrics';
import { money, useLiveQuery } from '../hooks';

/**
 * The immutable propagation stress: ONE writer (the market feed) updates prices through
 * `update()` recipes; ~60 components — one per instrument, EACH with its own filtered
 * subscription — receive fresh frozen instances and re-render.
 *
 * What each card demonstrates about immutable mode:
 *  - change detection is `previous !== next` — reference equality, no diffing;
 *  - instances are frozen (`Object.isFrozen`), so a stray mutation throws instead of
 *    corrupting the board;
 *  - write→render propagation latency is measured from the `updatedAt` the writer stamped
 *    inside its recipe.
 */

const INSTRUMENT_COUNT = 60;

const InstrumentCard = memo(function InstrumentCard(props: { id: string }) {
    const renders = useRef(0);
    const previousRef = useRef<Instrument | null>(null);
    const previousStampRef = useRef<number>(0);
    const [direction, setDirection] = useState<'up' | 'down' | null>(null);

    const live = useLiveQuery<Instrument | undefined>(
        cb => uiStore.instruments.subscribe()
            .where(([i, p]) => i.id === p.id, { id: props.id })
            .firstOrUndefined(cb as any) as any,
        [props.id],
    );

    renders.current++;

    const row = live.status === 'success' ? live.data : undefined;

    useEffect(() => {
        if (row == null) {
            return;
        }

        const previous = previousRef.current;

        // Reference equality IS the change detection: a new generation is a new object.
        if (previous !== null && previous !== row) {
            setDirection(row.price >= previous.price ? 'up' : 'down');

            const stamp = new Date(row.updatedAt).getTime();
            if (stamp !== previousStampRef.current) {
                metrics.notePropagation(Date.now() - stamp);
                previousStampRef.current = stamp;
            }
        }

        previousRef.current = row;
    }, [row]);

    if (row == null) {
        return <div className="card instrument">—</div>;
    }

    return (
        <div className={`card instrument ${direction ?? ''}`} data-symbol={row.symbol}>
            <div className="symbol">{row.symbol}</div>
            <div className="price">{money(row.price)}</div>
            <div className={`delta ${row.change >= 0 ? 'amount-pos' : 'amount-neg'}`}>
                {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}
            </div>
            <div className="renders">{renders.current}×</div>
        </div>
    );
});

/** Holds its FIRST reference forever — the stale-reference half of the demo. */
function StaleReferenceDemo() {
    const [firstRef, setFirstRef] = useState<Instrument | null>(null);
    const [probe, setProbe] = useState<{ isCurrent: boolean; frozen: boolean; stalePrice: number; currentPrice: number } | null>(null);

    useEffect(() => {
        uiStore.instruments.toArrayAsync().then(rows => setFirstRef((rows as Instrument[])[0] ?? null));
    }, []);

    useEffect(() => {
        if (firstRef == null) {
            return;
        }

        const interval = setInterval(() => {
            const current = uiStore.instruments.current(firstRef) as Instrument | undefined;
            setProbe({
                isCurrent: uiStore.instruments.isCurrent(firstRef),
                frozen: Object.isFrozen(firstRef),
                stalePrice: firstRef.price,
                currentPrice: current?.price ?? firstRef.price,
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [firstRef]);

    if (firstRef == null || probe == null) {
        return null;
    }

    return (
        <div className="card">
            <h3>Stale reference held since page load ({firstRef.symbol})</h3>
            <table>
                <tbody>
                    <tr><td>Reference is frozen</td><td className="num" data-testid="frozen">{String(probe.frozen)}</td></tr>
                    <tr><td>Reference still current</td><td className="num" data-testid="is-current">{String(probe.isCurrent)}</td></tr>
                    <tr><td>Price on the stale reference</td><td className="num">{money(probe.stalePrice)}</td></tr>
                    <tr><td>current(ref) resolves to</td><td className="num" data-testid="current-price">{money(probe.currentPrice)}</td></tr>
                </tbody>
            </table>
        </div>
    );
}

export function Market() {
    const [ids, setIds] = useState<string[]>([]);
    const [running, setRunning] = useState(false);
    const [rate, setRate] = useState(100);

    useEffect(() => {
        marketFeed.seed(uiStore, INSTRUMENT_COUNT)
            .then(() => uiStore.instruments.toArrayAsync())
            .then(rows => setIds((rows as Instrument[]).map(r => r.id).sort()));

        return () => marketFeed.stop();
    }, []);

    const toggle = async () => {
        if (running) {
            marketFeed.stop();
            setRunning(false);
            return;
        }

        await marketFeed.start(rate);
        setRunning(true);
    };

    return (
        <div>
            <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <strong>Market feed</strong>
                <span className="pill">1 writer · {ids.length} instruments · {ids.length} per-card subscriptions</span>
                <label style={{ color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    updates/s
                    <input type="range" min={10} max={500} step={10} value={rate} disabled={running}
                        onChange={e => setRate(Number(e.target.value))} />
                    <span className="count" style={{ color: 'var(--text)' }}>{rate}</span>
                </label>
                <button className={`feed-toggle ${running ? 'stop' : ''}`} onClick={toggle} disabled={ids.length === 0} data-testid="toggle-feed">
                    {running ? 'Stop feed' : 'Start feed'}
                </button>
            </div>

            <div style={{ marginBottom: 12 }}>
                {ids.length > 0 && <StaleReferenceDemo />}
            </div>

            <div className="instrument-grid" data-testid="board">
                {ids.map(id => <InstrumentCard key={id} id={id} />)}
            </div>
        </div>
    );
}
