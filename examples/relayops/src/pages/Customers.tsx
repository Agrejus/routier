import { useEffect, useState } from 'react';
import type { Customer } from '../schemas';
import { money, useLive } from '../hooks';
import { useStore } from '../StoreContext';

export function Customers() {
  const { store } = useStore();
  const customers = useLive<Customer[]>(cb => store.customers.subscribe().sortDescending(x => x.annualValue).toArray(cb as never) as never, [store]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    store.customers.leftJoin(s => s.workOrders, c => c.id, w => w.customerId).toArrayAsync().then(pairs => {
      const next: Record<string, number> = {};
      for (const [customer, order] of pairs) next[customer.id] = (next[customer.id] ?? 0) + (order ? 1 : 0);
      setCounts(next);
    }).catch(console.error);
  }, [store, customers.status === 'success' ? customers.data.length : 0]);
  const rows = customers.status === 'success' ? customers.data : [];
  const nudgeHealth = async (customer: Customer) => { customer.health = Math.min(100, customer.health + 1); await store.saveChangesAsync(); };

  return <section className="page" data-testid="customers-page"><div className="page-heading compact"><div><span className="eyebrow">Portfolio</span><h1>Customers</h1><p>Account health, service demand and managed value.</p></div></div>
    <div className="customer-grid">{rows.map(customer => <article className="customer-card" key={customer.id}><header><div className="customer-mark">{customer.name.split(' ').map(x => x[0]).slice(0, 2)}</div><div><h2>{customer.name}</h2><span>{customer.industry}</span></div><button className="more">•••</button></header><div className="health"><div><span>Account health</span><b>{customer.health}%</b></div><div className="health-track"><i style={{ width: `${customer.health}%` }} /></div></div><dl><div><dt>Open work</dt><dd>{counts[customer.id] ?? 0}</dd></div><div><dt>Annual value</dt><dd>{money(customer.annualValue)}</dd></div></dl><footer><div><strong>{customer.contactName}</strong><small>{customer.contactEmail}</small></div><button className="button small" onClick={() => nudgeHealth(customer)}>+ Health</button></footer></article>)}</div>
  </section>;
}
