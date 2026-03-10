import { DexiePlugin } from "@routier/dexie-plugin";
import { HttpSwrDbPlugin, OptimisticUpdatesDbPlugin } from "@routier/replication-plugin";
import type { SchemaPersistChanges } from "@routier/core/collections";
import type { CompiledSchema } from "@routier/core/schema";
import type { UnknownRecord } from "@routier/core/utilities";

type GetAccessToken = (opts?: { forceRefresh?: boolean }) => Promise<string>;

class AppSwrPlugin extends HttpSwrDbPlugin {
  protected override formatRequestBody(changes: SchemaPersistChanges<UnknownRecord>, _: CompiledSchema<UnknownRecord>) {
    const { adds, updates, removes } = changes;
    return JSON.stringify({ adds, updates, removes });
  }
}

const cacheDb = new DexiePlugin("__app_cache__");
const unsyncedQueueDb = new DexiePlugin("__app_unsynced__");
const optimisticDb = new OptimisticUpdatesDbPlugin(cacheDb);

export const createPlugin = (getAccessToken: GetAccessToken) => {
  let forceRefreshNext = false;

  return new AppSwrPlugin(optimisticDb, {
    getUrl: (collectionName) => `${import.meta.env.VITE_API_URL}/data/${collectionName}`,
    getHeaders: async () => {
      const token = await getAccessToken({ forceRefresh: forceRefreshNext });
      forceRefreshNext = false;

      const activeOrgId =
        typeof window !== "undefined"
          ? window.localStorage.getItem("currentOrganizationId")
          : null;

      return {
        Authorization: `Bearer ${token}`,
        ...(activeOrgId ? { "x-org-id": activeOrgId } : {}),
      };
    },
    ignoreQueryForCollections: ["users"],
    maxAgeMs: 30_000,
    onAuthError: () => {
      forceRefreshNext = true;
    },
    unsyncedQueueStore: unsyncedQueueDb,
    translateRemoteResponse(_schema, data) {
      return (data as { data?: unknown[] }).data ?? [];
    },
  });
};
