import type { IDbPlugin } from '@routier/core/plugins';
import { MemoryPlugin } from '@routier/memory-plugin';
import { BrowserStoragePlugin } from '@routier/browser-storage-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import { PouchDbPlugin } from '@routier/pouchdb-plugin';
import { HttpTransportDbPlugin } from '@routier/replication-plugin';
import { RelayStore } from './store';

export type BackendKind = 'memory' | 'localStorage' | 'dexie' | 'pouchdb' | 'remote';

export function pluginFor(kind: BackendKind): IDbPlugin {
  switch (kind) {
    case 'localStorage': return new BrowserStoragePlugin('relayops-local-v1', window.localStorage);
    case 'dexie': return new DexiePlugin('relayops-dexie-v1', { version: 1 });
    case 'pouchdb': return new PouchDbPlugin('relayops-pouch-v1');
    case 'remote': return new HttpTransportDbPlugin({
      url: '/routier', databaseName: 'relayops-remote',
      getHeaders: () => ({ Authorization: 'Bearer demo-acme' }),
    });
    default: return new MemoryPlugin(`relayops-memory-${crypto.randomUUID()}`);
  }
}
export const createBrowserStore = (kind: BackendKind) => new RelayStore(pluginFor(kind));
