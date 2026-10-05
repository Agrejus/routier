import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import {
  createRetry,
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

    const backoff = createRetry({ maxAttempts: 5 });

    const sync = new HttpSwrDbPlugin(memoryFirstCache, {
      databaseName: `${storageNamespace}:production-api`,
      getUrl: collection => `https://api.example.com/data/${collection}`,
      getHeaders: async () => ({
        Authorization: `Bearer ${await getAccessToken()}`,
      }),
      maxAgeMs: 30_000,
      unsyncedQueueStore: queue,
      autoSync: true,

      // Adapt GET responses such as { data: [...] }.
      translateRemoteResponse(_schema, body) {
        return (body as { data?: unknown[] }).data ?? [];
      },

      // Reconcile server-generated ids, versions, and timestamps after POST.
      translatePersistResponse(_schema, body) {
        return (body as { data?: unknown[] }).data ?? null;
      },

      // Decide what each failing request does. getHeaders runs again for every retry.
      onError: async (error) => {
        if (error.kind === "http" && error.status === 401 && error.attempt === 1) {
          await refreshToken();
          return error.retry();
        }

        if (error.kind === "network" && error.operation === "read") {
          return error.useCached();
        }

        return backoff(error);
      },

      // Report what happened, for status UI and logging.
      onEvent(event) {
        if (event.type === "read" && !event.ok) {
          console.warn("Showing cached data; refresh failed", event.collectionName, event.error);
        }

        if (event.type === "changes-rejected") {
          console.error(
            event.conflict ? "Server rejected a conflicting local change" : "Changes need user or developer action",
            event.changes,
            event.error,
          );
        }
      },
    });

    super(sync);
    this.sync = sync;
  }

  products = this.collection(productSchema).proxy().create();
}
