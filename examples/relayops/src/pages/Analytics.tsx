import { useEffect, useState } from 'react';
import type { TimeEntry, WorkOrder } from '../schemas';
import { useLive } from '../hooks';
import { useStore } from '../StoreContext';

export function Analytics() {
  const { store } = useStore();
  const orders = useLive<WorkOrder[]>(cb => store.workOrders.subscribe().toArray(cb as never) as never, [store]);
  const time = useLive<TimeEntry[]>(cb => store.timeEntries.subscribe().toArray(cb as never) as never, [store]);
  const [aggregates, setAggregates] = useState({ max: 0, min: 0, total: 0, distinct: 0 });
  useEffect(() => { Promise.all([
    store.workOrders.maxAsync(x => x.estimateHours), store.workOrders.minAsync(x => x.estimateHours),
    store.timeEntries.sumAsync(x => x.minutes), store.workOrders.map(x => x.category).distinctAsync(),
  ]).then(([max, min, total, categories]) => setAggregates({ max: max ?? 0, min: min ?? 0, total: total ?? 0, distinct: categories.length })).catch(console.error); }, [store, time.status === 'success' ? time.data.length : 0]);
  const rows = orders.status === 'success' ? orders.data : [];
  const total = rows.length || 1;
  const byStatus = ['backlog', 'scheduled', 'in_progress', 'blocked', 'done'].map(status => ({ status, count: rows.filter(x => x.status === status).length }));
  const byCategory = [...new Set(rows.map(x => x.category))].map(category => ({ category, hours: rows.filter(x => x.category === category).reduce((n, x) => n + x.estimateHours, 0) })).sort((a, b) => b.hours - a.hours);

  return <section className="page" data-testid="analytics-page"><div className="page-heading compact"><div><span className="eyebrow">Query terminals</span><h1>Service analytics</h1><p>Aggregations, distinct selection and grouped client projections.</p></div></div>
    <div className="stats-grid"><Stat label="Minutes logged" value={aggregates.total.toLocaleString()} /><Stat label="Largest estimate" value={`${aggregates.max}h`} /><Stat label="Smallest estimate" value={`${aggregates.min}h`} /><Stat label="Service categories" value={aggregates.distinct} /></div>
    <div className="analytics-grid"><div className="panel"><div className="panel-title"><div><span className="eyebrow">Distribution</span><h2>Work by status</h2></div></div><div className="bars">{byStatus.map(x => <div className="bar-row" key={x.status}><span>{x.status.replace('_', ' ')}</span><div><i style={{ width: `${Math.max(4, x.count / total * 100)}%` }} /></div><b>{x.count}</b></div>)}</div></div>
      <div className="panel"><div className="panel-title"><div><span className="eyebrow">Capacity</span><h2>Estimated hours</h2></div></div><div className="donut-wrap"><div className="donut"><strong>{rows.reduce((n, x) => n + x.estimateHours, 0)}</strong><span>hours</span></div><div className="legend">{byCategory.map((x, i) => <div key={x.category}><i className={`color-${i}`} /><span>{x.category}</span><b>{x.hours}h</b></div>)}</div></div></div></div>
  </section>;
}
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat-card plain"><span>{label}</span><strong>{value}</strong><small>Live from active data store</small></div>; }
