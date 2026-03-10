import { DataStore } from "@routier/datastore";
import { OptimisticUpdatesDbPlugin, HttpSwrDbPlugin } from "@routier/replication-plugin";
import { DexiePlugin } from "@routier/dexie-plugin";

const baseUrl = "https://api.example.com";

// Separate Dexie databases: SWR cache + unsynced queue (required for Dexie)
const swrStoreDb = new DexiePlugin("myapp_swr");
const unsyncedQueueDb = new DexiePlugin("myapp_unsynced");

// Optimistic plugin wraps Dexie: reads from memory, writes to Dexie
const optimisticPlugin = new OptimisticUpdatesDbPlugin(swrStoreDb);

const createPlugin = (getAccessToken: () => Promise<string>) =>
  new HttpSwrDbPlugin(optimisticPlugin, {
    getUrl: (collectionName) => `${baseUrl}/${collectionName}`,
    getHeaders: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
    maxAgeMs: 30_000,
    unsyncedQueueStore: unsyncedQueueDb,
    translateRemoteResponse(_schema, data) {
      const response = data as { data: unknown[] };
      return response.data ?? [];
    },
  });

export class AppDataStore extends DataStore {
  constructor(getAccessToken: () => Promise<string>) {
    super(createPlugin(getAccessToken));
  }
}