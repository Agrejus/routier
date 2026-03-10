// ✅ CORRECT - Memoized instance
function ProductsList() {
  const dataStore = useDataStore(); // Memoized in hook

  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    [dataStore] // Stable reference
  );
}

// In your useDataStore hook:
export function useDataStore() {
  // This will cause subscriptions to run infinitely if this is not done
  const dataStore = useMemo(() => new DataStore(new MemoryPlugin("app")), []);
  return dataStore;
}