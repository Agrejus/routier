import { useStore } from '../StoreContext';
import { date, money, useLive } from '../hooks';
import type { WorkOrder } from '../schemas';

export function Dashboard({ openOrder }: { openOrder: (id: string) => void }) {
  const { store } = useStore();
  const orders = useLive<WorkOrder[]>(cb => store.workOrders.subscribe().sortDescending(x => x.updatedAt).toArray(cb as never) as never, [store]);
  const customers = useLive<number>(cb => store.customers.subscribe().count(cb as never) as never, [store]);
  const open = useLive<number>(cb => store.workOrders.subscribe().where(x => x.status !== 'done').count(cb as never) as never, [store]);
  const urgent = useLive<number>(cb => store.workOrders.subscribe().where(x => x.priority === 'urgent' && x.status !== 'done').count(cb as never) as never, [store]);
  const revenue = useLive<number>(cb => store.customers.subscribe().sum(x => x.annualValue, cb as never) as never, [store]);
  const rows = orders.status === 'success' ? orders.data : [];

  return <section className="page" data-testid="dashboard-page">
    <div className="page-heading"><div><span className="eyebrow">Operations overview</span><h1>Good morning, Alex</h1><p>Here’s what needs attention across the service desk.</p></div><a className="button primary" href="#/work-orders/new">＋ New work order</a></div>
    <div className="stats-grid">
      <Stat label="Open work" value={open.status === 'success' ? open.data : '—'} detail="Across five customer sites" tone="navy" />
      <Stat label="Urgent" value={urgent.status === 'success' ? urgent.data : '—'} detail="Requires same-day response" tone="red" />
      <Stat label="Customers" value={customers.status === 'success' ? customers.data : '—'} detail="Active managed accounts" tone="green" />
      <Stat label="Managed value" value={revenue.status === 'success' ? money(revenue.data) : '—'} detail="Annual recurring value" tone="gold" />
    </div>
    <div className="dashboard-grid">
      <div className="panel"><div className="panel-title"><div><span className="eyebrow">Live queue</span><h2>Recently updated</h2></div><a href="#/work-orders">View all →</a></div>
        <div className="order-list">{rows.slice(0, 6).map(order => <button className="order-row" key={order.id} onClick={() => openOrder(order.id)}>
          <span className={`priority-dot ${order.priority}`} /><span className="order-main"><strong>{order.title}</strong><small>{order.category} · Updated {date(order.updatedAt)}</small></span><Status value={order.status} /><span className="chevron">›</span>
        </button>)}</div>
      </div>
      <div className="panel schedule"><div className="panel-title"><div><span className="eyebrow">Schedule</span><h2>Field visits</h2></div></div>
        {rows.filter(x => x.scheduledFor).slice(0, 4).map(x => <div className="schedule-row" key={x.id}><div className="calendar-tile"><b>{new Date(x.scheduledFor!).getDate()}</b><span>{new Date(x.scheduledFor!).toLocaleDateString('en-US', { month: 'short' })}</span></div><div><strong>{x.title}</strong><small>{x.category} · {date(x.scheduledFor)}</small></div></div>)}
      </div>
    </div>
  </section>;
}

function Stat({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: string }) {
  return <div className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
export function Status({ value }: { value: string }) { return <span className={`status ${value}`}>{value.replace('_', ' ')}</span>; }
