import { Analytics } from './pages/Analytics';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Knowledge } from './pages/Knowledge';
import { Settings } from './pages/Settings';
import { WorkOrders } from './pages/WorkOrders';
import { useHashRoute } from './hooks';
import { useStore } from './StoreContext';

const nav = [
  ['dashboard', '⌂', 'Overview'], ['work-orders', '▤', 'Work orders'], ['customers', '◎', 'Customers'],
  ['knowledge', '◇', 'Knowledge'], ['analytics', '⌁', 'Analytics'], ['settings', '⚙', 'Storage lab'],
] as const;

export function App() {
  const { route, navigate } = useHashRoute();
  const { backend, setBackend, ready, error } = useStore();
  const [section, id] = route.split('/');
  const current = nav.find(x => x[0] === section)?.[2] ?? 'Overview';
  if (error) return <div className="fatal"><h1>RelayOps could not open {backend}</h1><pre>{error}</pre><button className="button primary" onClick={() => setBackend('memory')}>Recover with Memory store</button></div>;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#/dashboard"><span className="brand-mark">R</span><span><b>Relay</b>Ops</span></a><div className="workspace"><span className="workspace-mark">N</span><div><strong>North Region</strong><small>Managed services</small></div><span>⌄</span></div><nav>{nav.map(([path, icon, label]) => <a key={path} className={section === path ? 'active' : ''} href={`#/${path}`}><span>{icon}</span>{label}{path === 'work-orders' && <b className="nav-count">9</b>}</a>)}</nav><div className="sidebar-foot"><div className="storage-chip"><i className={ready ? 'online' : ''} /><div><small>Active store</small><strong>{backend}</strong></div></div><div className="user"><span>AM</span><div><strong>Alex Morgan</strong><small>Dispatcher</small></div><b>•••</b></div></div></aside>
    <div className="content"><header className="topbar"><div><span>RelayOps</span><b>/</b><strong>{current}</strong></div><div><span className="sync-state">{ready ? '● Data live' : '○ Seeding…'}</span><button className="top-icon" aria-label="Notifications">♢<i>3</i></button><button className="top-icon" aria-label="Help">?</button></div></header>
      <main>{!ready ? <div className="loading"><div /><p>Opening {backend} and preparing workspace…</p></div> : <Route section={section} id={id} navigate={navigate} />}</main>
    </div>
  </div>;
}

function Route({ section, id, navigate }: { section: string; id?: string; navigate: (route: string) => void }) {
  if (section === 'work-orders') return <WorkOrders selectedId={id && id !== 'new' ? id : undefined} create={id === 'new'} navigate={navigate} />;
  if (section === 'customers') return <Customers />;
  if (section === 'knowledge') return <Knowledge />;
  if (section === 'analytics') return <Analytics />;
  if (section === 'settings') return <Settings />;
  return <Dashboard openOrder={id => navigate(`work-orders/${id}`)} />;
}
