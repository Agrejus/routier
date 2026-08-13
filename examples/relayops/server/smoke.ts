import { HttpTransportDbPlugin } from '@routier/replication-plugin';
import { MemoryPlugin } from '@routier/memory-plugin';
import { RelayStore, seedStore } from '../src/store';

export async function smokeLocal() {
  const store = new RelayStore(new MemoryPlugin(`relayops-local-smoke-${crypto.randomUUID()}`));
  try {
    await seedStore(store);
    const search = await store.articles.search('packet loss', { match: 'all' }).toArrayAsync();
    const nearest = await store.articles.nearest(x => x.embedding, [0.8, 0.2, 0.3, 0.1], 2).toArrayAsync();
    const order = await store.workOrders.firstAsync();
    order.status = 'done';
    await store.saveChangesAsync();
    const audit = await store.audit.where(x => x.operation === 'update').countAsync();
    await store.workOrders.removeAsync(order);
    await store.saveChangesAsync();
    return { search: search.length, nearest: nearest.length, audit, visibleAfterSoftDelete: await store.workOrders.countAsync() };
  } finally { await store.destroyAsync(); }
}

export async function smoke(url: string) {
  const store = new RelayStore(new HttpTransportDbPlugin({
    url: `${url}/routier`, databaseName: 'relayops-smoke',
    getHeaders: () => ({ Authorization: 'Bearer demo-acme' }),
  }));
  try {
    const [open, urgent, joined] = await Promise.all([
      store.workOrders.where(x => x.status !== 'done').countAsync(),
      store.workOrders.where(x => x.priority === 'urgent').sort(x => x.title).toArrayAsync(),
      store.customers.leftJoin(s => s.workOrders, c => c.id, w => w.customerId).take(5).toArrayAsync(),
    ]);
    return { open, urgent: urgent.length, joined: joined.length, firstCustomer: joined[0]?.[0].name };
  } finally { store[Symbol.dispose](); }
}
