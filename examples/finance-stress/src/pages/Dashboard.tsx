import { uiStore } from '../store';
import { Account, Transaction } from '../schemas';
import { money, useLiveQuery } from '../hooks';

/**
 * Every number on this page is a live subscription — the dashboard is deliberately the
 * noisiest subscriber in the app.
 *
 * The one that matters most is DRIFT: every account seeds at $1,000 and transfers conserve
 * money, so (total balance − accounts × 1000) must stay ZERO. Any drift is a lost update —
 * two writers racing the same account across stores — surfaced instead of hidden.
 */
export function Dashboard(props: { onOpenAccount: (id: string) => void }) {
    const accounts = useLiveQuery<Account[]>(cb => uiStore.accounts.subscribe().toArray(cb as any) as any, []);
    const recent = useLiveQuery<Transaction[]>(
        cb => uiStore.transactions.subscribe().sortDescending(t => t.at).take(25).toArray(cb as any) as any,
        [],
    );
    const txCount = useLiveQuery<number>(cb => uiStore.transactions.subscribe().count(cb as any) as any, []);

    const accountList = accounts.status === 'success' ? accounts.data : [];
    const total = accountList.reduce((sum, account) => sum + account.balance, 0);
    const expected = accountList.length * 1000;
    // `|| 0` normalizes float negative-zero so a perfect ledger never renders -$0.00
    const drift = (Math.round((total - expected) * 100) / 100) || 0;

    return (
        <div>
            <div className="grid" style={{ marginBottom: 16 }}>
                <div className="card">
                    <h3>Total balance</h3>
                    <div className="big">{money(total)}</div>
                </div>
                <div className="card">
                    <h3>Invariant drift (must be $0.00)</h3>
                    <div className="big" style={{ color: drift === 0 ? 'var(--good)' : 'var(--bad)' }} data-testid="drift">
                        {money(drift)}
                    </div>
                </div>
                <div className="card">
                    <h3>Accounts</h3>
                    <div className="big">{accountList.length}</div>
                </div>
                <div className="card">
                    <h3>Ledger rows</h3>
                    <div className="big" data-testid="tx-count">{txCount.status === 'success' ? txCount.data.toLocaleString() : '—'}</div>
                </div>
            </div>

            <div className="card">
                <h3>Latest transactions (live)</h3>
                <table>
                    <thead>
                        <tr><th>When</th><th>Category</th><th>Memo</th><th className="num">Amount</th></tr>
                    </thead>
                    <tbody>
                        {recent.status === 'success' && recent.data.map(tx => (
                            <tr key={tx.id} className="clickable" onClick={() => props.onOpenAccount(tx.fromAccountId)}>
                                <td>{new Date(tx.at).toLocaleTimeString()}</td>
                                <td><span className="pill">{tx.category}</span></td>
                                <td>{tx.memo}</td>
                                <td className="num">{money(tx.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
