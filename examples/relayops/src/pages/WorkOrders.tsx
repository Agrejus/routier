import { FormEvent, useMemo, useState } from 'react';
import { date, useLive } from '../hooks';
import { useStore } from '../StoreContext';
import type { Agent, Customer, WorkOrder } from '../schemas';
import { Status } from './Dashboard';

const lanes = ['backlog', 'scheduled', 'in_progress', 'blocked', 'done'] as const;

export function WorkOrders({ selectedId, create, navigate }: { selectedId?: string; create?: boolean; navigate: (route: string) => void }) {
  const { store } = useStore();
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const orders = useLive<WorkOrder[]>(cb => store.workOrders.subscribe().sortDescending(x => x.updatedAt).toArray(cb as never) as never, [store]);
  const customers = useLive<Customer[]>(cb => store.customers.subscribe().sort(x => x.name).toArray(cb as never) as never, [store]);
  const agents = useLive<Agent[]>(cb => store.agents.subscribe().toArray(cb as never) as never, [store]);
  const rows = orders.status === 'success' ? orders.data : [];
  const filtered = useMemo(() => rows.filter(x => (priority === 'all' || x.priority === priority) && `${x.title} ${x.description} ${x.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [rows, query, priority]);
  const selected = selectedId ? rows.find(x => x.id === selectedId) : undefined;

  return <section className="page" data-testid="work-orders-page">
    <div className="page-heading compact"><div><span className="eyebrow">Service delivery</span><h1>Work orders</h1><p>{filtered.length} visible items · live query</p></div><button className="button primary" onClick={() => navigate('work-orders/new')}>＋ New work order</button></div>
    <div className="toolbar"><label className="search"><span>⌕</span><input aria-label="Search work orders" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, description or tag…" /></label><select aria-label="Priority filter" value={priority} onChange={e => setPriority(e.target.value)}><option value="all">All priorities</option><option>urgent</option><option>high</option><option>medium</option><option>low</option></select></div>
    <div className="kanban">{lanes.map(lane => <div className="lane" key={lane}><div className="lane-title"><span>{lane.replace('_', ' ')}</span><b>{filtered.filter(x => x.status === lane).length}</b></div>{filtered.filter(x => x.status === lane).map(order => <button className="ticket" key={order.id} onClick={() => navigate(`work-orders/${order.id}`)}><div><span className={`priority-label ${order.priority}`}>{order.priority}</span><small>#{order.id.slice(0, 6)}</small></div><h3>{order.title}</h3><p>{order.description}</p><footer><span>{order.category}</span><span>{date(order.scheduledFor)}</span></footer></button>)}</div>)}</div>
    {(selected || create) && <OrderDrawer order={selected} customers={customers.status === 'success' ? customers.data : []} agents={agents.status === 'success' ? agents.data : []} close={() => navigate('work-orders')} />}
  </section>;
}

function OrderDrawer({ order, customers, agents, close }: { order?: WorkOrder; customers: Customer[]; agents: Agent[]; close: () => void }) {
  const { store } = useStore();
  const notes = useLive<any[]>(cb => order ? store.notes.subscribe().where(([n, p]) => n.workOrderId === p.id, { id: order.id }).sortDescending(n => n.createdAt).toArray(cb as never) as never : cb({ ok: 'success', data: [] } as never), [store, order?.id]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      if (order) {
        order.title = String(form.get('title'));
        order.description = String(form.get('description'));
        order.status = String(form.get('status')) as WorkOrder['status'];
        order.priority = String(form.get('priority')) as WorkOrder['priority'];
        order.assigneeId = String(form.get('assigneeId')) || null;
        order.updatedAt = new Date();
      } else {
        await store.workOrders.tag({ actor: 'alex', source: 'drawer' }).addAsync({
          customerId: String(form.get('customerId')), assigneeId: String(form.get('assigneeId')) || null,
          title: String(form.get('title')), description: String(form.get('description')),
          status: 'backlog', priority: String(form.get('priority')) as WorkOrder['priority'], category: 'Software',
          scheduledFor: null, createdAt: new Date(), updatedAt: new Date(), estimateHours: 2, tags: ['new'], deletedAt: null,
        });
      }
      await store.saveChangesAsync(); close();
    } finally { setSaving(false); }
  };
  const addNote = async () => {
    if (!order || !note.trim()) return;
    const agent = agents[0]; if (!agent) return;
    await store.notes.addAsync({ workOrderId: order.id, authorId: agent.id, body: note.trim(), createdAt: new Date(), kind: 'comment' });
    await store.saveChangesAsync(); setNote('');
  };
  const remove = async () => { if (!order || !confirm('Archive this work order?')) return; await store.workOrders.removeAsync(order); await store.saveChangesAsync(); close(); };

  return <div className="drawer-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) close(); }}><aside className="drawer" role="dialog" aria-label={order ? 'Edit work order' : 'New work order'}><header><div><span className="eyebrow">{order ? `Work order #${order.id.slice(0, 8)}` : 'Create record'}</span><h2>{order ? order.title : 'New work order'}</h2></div><button className="icon-button" onClick={close}>×</button></header>
    <form onSubmit={submit}><label>Title<input name="title" required defaultValue={order?.title} /></label><label>Description<textarea name="description" required defaultValue={order?.description} /></label>
      {!order && <label>Customer<select name="customerId" required>{customers.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>}
      <div className="form-grid"><label>Priority<select name="priority" defaultValue={order?.priority ?? 'medium'}><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></label>{order && <label>Status<select name="status" defaultValue={order.status}>{lanes.map(x => <option value={x} key={x}>{x.replace('_', ' ')}</option>)}</select></label>}</div>
      <label>Assignee<select name="assigneeId" defaultValue={order?.assigneeId ?? ''}><option value="">Unassigned</option>{agents.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
      <div className="form-actions">{order && <button type="button" className="button danger" onClick={remove}>Archive</button>}<span /><button type="button" className="button" onClick={close}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save work order'}</button></div>
    </form>
    {order && <div className="drawer-notes"><h3>Activity</h3><div className="note-compose"><input aria-label="Add note" value={note} onChange={e => setNote(e.target.value)} placeholder="Add an internal note…" /><button className="button" onClick={addNote}>Add</button></div>{notes.status === 'success' && notes.data.map(n => <div className="note" key={n.id}><b>{n.kind}</b><p>{n.body}</p><small>{new Date(n.createdAt).toLocaleString()}</small></div>)}</div>}
  </aside></div>;
}
