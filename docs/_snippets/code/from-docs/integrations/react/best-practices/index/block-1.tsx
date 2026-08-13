// hooks/useDataStore.ts
import { useMemo } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

export function useDataStore() {
  // This will cause subscriptions to run infinitely if this is not done
  // Always use useMemo to prevent infinite subscription loops
  const dataStore = useMemo(() => new DataStore(new MemoryPlugin("app")), []);
  return dataStore;
}