import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import { HttpSwrDbPlugin, OptimisticUpdatesDbPlugin } from "@routier/replication-plugin";

const cacheDb = new DexiePlugin("myapp_cache");
const unsyncedQueueDb = new DexiePlugin("myapp_unsynced");
const optimisticDb = new OptimisticUpdatesDbPlugin(cacheDb);

const plugin = new HttpSwrDbPlugin(optimisticDb, {
  getUrl: (collectionName) => `https://api.example.com/${collectionName}`,
  getHeaders: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
  maxAgeMs: 30_000,
  unsyncedQueueStore: unsyncedQueueDb,
  translateRemoteResponse(_schema, data) {
    return (data as { data?: unknown[] }).data ?? [];
  },
});

declare function getAccessToken(): Promise<string>;

export class AppDataStore extends DataStore {
  constructor() {
    super(plugin);
  }
}
