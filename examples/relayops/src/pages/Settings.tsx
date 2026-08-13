import type { AuditRow } from '../schemas';
import { BackendKind } from '../browserStore';
import { useLive } from '../hooks';
import { useStore } from '../StoreContext';

const backends: { id: BackendKind; name: string; detail: string }[] = [
  { id: 'memory', name: 'Memory', detail: 'Ephemeral, fastest reset loop' },
  { id: 'localStorage', name: 'Browser Storage', detail: 'Durable localStorage collections' },
  { id: 'dexie', name: 'Dexie', detail: 'IndexedDB with indexed queries' },
  { id: 'pouchdb', name: 'PouchDB', detail: 'Document store and replication-ready' },
  { id: 'remote', name: 'HTTP Transport', detail: 'Queries execute on the Node backend' },
];

export function Settings() {
  const { store, backend, setBackend, reset } = useStore();
  const audit = useLive<AuditRow[]>(cb => store.audit.subscribe().sortDescending(x => x.at).take(12).toArray(cb as never) as never, [store]);
  const rows = audit.status === 'success' ? audit.data : [];
  return <section className="page" data-testid="settings-page"><div className="page-heading compact"><div><span className="eyebrow">Dogfood console</span><h1>Storage & diagnostics</h1><p>Swap the complete application between interchangeable Routier plugins.</p></div></div>
    <div className="settings-grid"><div className="panel"><div className="panel-title"><div><span className="eyebrow">Runtime</span><h2>Data store</h2></div></div><div className="backend-list">{backends.map(item => <button key={item.id} className={backend === item.id ? 'selected' : ''} onClick={() => setBackend(item.id)}><span className="radio" /><div><strong>{item.name}</strong><small>{item.detail}</small></div>{backend === item.id && <b>Active</b>}</button>)}</div><div className="reset-zone"><div><strong>Reset active database</strong><small>Destroy its contents and reseed the demo records.</small></div><button className="button danger" disabled={backend === 'remote'} title={backend === 'remote' ? 'Remote data is owned by the server' : undefined} onClick={() => { if (confirm(`Reset ${backend}?`)) reset(); }}>{backend === 'remote' ? 'Server managed' : 'Reset & seed'}</button></div></div>
      <div className="panel"><div className="panel-title"><div><span className="eyebrow">Automatic audit collection</span><h2>Recent writes</h2></div><span className="live-pill">● live</span></div><div className="audit-list">{rows.length === 0 && <div className="empty">Edit a work order to generate audit events.</div>}{rows.map(row => <div key={row.id}><span className={`audit-icon ${row.operation}`}>{row.operation === 'add' ? '+' : row.operation === 'update' ? '↻' : '−'}</span><div><strong>{row.summary}</strong><small>{new Date(row.at).toLocaleString()} · {row.entityId.slice(0, 8)}</small></div></div>)}</div></div></div>
  </section>;
}
