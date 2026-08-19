import { uiStore } from '../store';
import { Account, Transaction } from '../schemas';
import { money, useLiveQuery } from '../hooks';

/**
 * The page that exercises defect #24's fix under load: the transaction list is a FILTERED
 * subscription (rows involving this account), so rows constantly enter its result set
 * while the simulator runs.
 */
export function AccountDetail(props: { accountId: string; onBack: () => void }) {
    const account = useLiveQuery<Account | undefined>(
        cb => uiStore.accounts.subscribe().where(([a, p]) => a.id === p.id, { id: props.accountId }).firstOrUndefined(cb),
        [props.accountId],
    );

    const activity = useLiveQuery<Transaction[]>(
        cb => uiStore.transactions.subscribe()
            .where(([t, p]) => t.fromAccountId === p.id || t.toAccountId === p.id, { id: props.accountId })
            .sortDescending(t => t.at)
            .take(50)
            .toArray(cb),
        [props.accountId],
    );

    const current = account.status === 'success' ? account.data : undefined;

    return (
        <div>
            <button className="back" onClick={props.onBack}>← Back to accounts</button>

            <div className="grid" style={{ marginBottom: 16 }}>
                <div className="card">
                    <h3>{current?.name ?? 'Loading…'}</h3>
                    <div className="big">{current != null ? money(current.balance) : '—'}</div>
                </div>
            </div>

            <div className="card">
                <h3>Activity (live, filtered subscription)</h3>
                <table>
                    <thead>
                        <tr><th>When</th><th>Direction</th><th>Category</th><th className="num">Amount</th></tr>
                    </thead>
                    <tbody>
                        {activity.status === 'success' && activity.data.map(tx => {
                            const outgoing = tx.fromAccountId === props.accountId;
                            return (
                                <tr key={tx.id}>
                                    <td>{new Date(tx.at).toLocaleTimeString()}</td>
                                    <td className={outgoing ? 'amount-neg' : 'amount-pos'}>{outgoing ? 'out' : 'in'}</td>
                                    <td><span className="pill">{tx.category}</span></td>
                                    <td className={`num ${outgoing ? 'amount-neg' : 'amount-pos'}`}>
                                        {outgoing ? '−' : '+'}{money(tx.amount)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
