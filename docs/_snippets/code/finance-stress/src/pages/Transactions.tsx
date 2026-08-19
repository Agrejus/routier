import { useState } from 'react';
import { uiStore } from '../store';
import { CATEGORIES, Transaction } from '../schemas';
import { money, useLiveQuery } from '../hooks';

export function Transactions() {
    const [category, setCategory] = useState<string | null>(null);

    const transactions = useLiveQuery<Transaction[]>(
        cb => (category == null
            ? uiStore.transactions.subscribe().sortDescending(t => t.at).take(100).toArray(cb)
            : uiStore.transactions.subscribe()
                .where(([t, p]) => t.category === p.category, { category })
                .sortDescending(t => t.at)
                .take(100)
                .toArray(cb)),
        [category],
    );

    return (
        <div className="card">
            <h3>Transactions (live{category ? `, ${category} only` : ''})</h3>
            <div className="filters">
                <button className={category == null ? 'active' : ''} onClick={() => setCategory(null)}>all</button>
                {CATEGORIES.map(name => (
                    <button key={name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>
                        {name}
                    </button>
                ))}
            </div>
            <table>
                <thead>
                    <tr><th>When</th><th>Category</th><th>Memo</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                    {transactions.status === 'success' && transactions.data.map(tx => (
                        <tr key={tx.id}>
                            <td>{new Date(tx.at).toLocaleTimeString()}</td>
                            <td><span className="pill">{tx.category}</span></td>
                            <td>{tx.memo}</td>
                            <td className="num">{money(tx.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
