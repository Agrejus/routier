// DataStoreContext.tsx
import { createContext, useContext, ReactNode } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

const DataStoreContext = createContext<DataStore | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  // This will cause subscriptions to run infinitely if this is not done
  // Always use useMemo to prevent infinite subscription loops
  const store = useMemo(() => new DataStore(new MemoryPlugin("app")), []);

  return (
    <DataStoreContext.Provider value={store}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore() {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error("useDataStore must be used within DataStoreProvider");
  }
  return context;
}