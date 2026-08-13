import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import {
  HttpSwrDbPlugin,
  OptimisticUpdatesDbPlugin,
} from "@routier/replication-plugin";
import { productSchema } from "./schemas";

export class AppDataStore extends DataStore {
  readonly sync: HttpSwrDbPlugin;

  constructor(
    storageNamespace: string, // A stable, non-secret account/tenant namespace.
    getAccessToken: () => Promise<string>,
    refreshToken: () => Promise<void>,
  ) {
    const cache = new DexiePlugin(`${storageNamespace}_cache`);
    const queue = new DexiePlugin(`${storageNamespace}_unsynced`);

    // Optional: hydrate a memory read model from the durable IndexedDB cache.
    const memoryFirstCache = new OptimisticUpdatesDbPlugin(cache);

    const sync = new HttpSwrDbPlugin(memoryFirstCache, {
      databaseName: `${storageNamespace}:production-api`,
      getUrl: collection => `https://api.example.com/data/${collection}`,
      getHeaders: async () => ({
        Authorization: `Bearer ${await getAccessToken()}`,
      }),
      maxAgeMs: 30_000,
      unsyncedQueueStore: queue,

      // Adapt GET responses such as { data: [...] }.
      translateRemoteResponse(_schema, body) {
        return (body as { data?: unknown[] }).data ?? [];
      },

      // Reconcile server-generated ids, versions, and timestamps after POST.
      translatePersistResponse(_schema, body) {
        return (body as { data?: unknown[] }).data ?? null;
      },

      // Returning true permits one retry with newly evaluated headers.
      onAuthError: async () => {
        await refreshToken();
        return true;
      },
      onRevalidateError(error, context) {
        console.warn("Showing cached data; refresh failed", context, error);
      },
      onConflict(context) {
        console.warn("Server rejected a conflicting local change", context);
      },
      onSyncDeadLetter(changes, error) {
        console.error("Changes need user or developer action", changes, error);
      },
    });

    super(sync);
    this.sync = sync;
  }

  products = this.collection(productSchema).proxy().create();
}
