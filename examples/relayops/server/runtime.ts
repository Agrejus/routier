import path from 'node:path';
import { createRequestHandler, type SerializedRequest } from '@routier/core/plugins';
import { FileSystemPlugin } from '@routier/file-system-plugin';
import { RelayStore, seedStore } from '../src/store';

export async function createRuntime(root: string) {
  const store = new RelayStore(new FileSystemPlugin(path.join(root, '.data'), 'relayops-server.json'));
  await seedStore(store);
  const handle = createRequestHandler<{ tenant: string }>({
    plugin: store.getDbPlugin(), schemas: store.schemas,
    authorize: ({ context }) => context.tenant === 'demo-acme' || 'A valid demo tenant token is required',
  });
  return {
    store,
    handle: (body: SerializedRequest, tenant: string) => handle(body, { tenant }),
    status: async () => ({ ok: true, database: store.getDbPlugin().databaseName, counts: {
      customers: await store.customers.countAsync(), workOrders: await store.workOrders.countAsync(), articles: await store.articles.countAsync(),
    }}),
  };
}
