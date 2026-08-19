import { uiStore } from '../store';
import { Account } from '../schemas';
import { money, useLiveQuery } from '../hooks';

export function Accounts(props: { onOpenAccount: (id: string) => void }) {
    const accounts = useLiveQuery<Account[]>(
        cb => uiStore.accounts.subscribe().sort(a => a.name).toArray(cb),
        [],
    );

    return (
        <div className="card">
            <h3>Accounts (live balances)</h3>
            <table>
                <thead>
                    <tr><th>Name</th><th>Type</th><th className="num">Balance</th></tr>
                </thead>
                <tbody>
                    {accounts.status === 'success' && accounts.data.map(account => (
                        <tr key={account.id} className="clickable" onClick={() => props.onOpenAccount(account.id)}>
                            <td>{account.name}</td>
                            <td><span className="pill">{account.kind}</span></td>
                            <td className={`num ${account.balance < 0 ? 'amount-neg' : ''}`}>{money(account.balance)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
