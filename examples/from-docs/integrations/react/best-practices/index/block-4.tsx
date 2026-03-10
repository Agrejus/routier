// ❌ WRONG - This will cause infinite subscriptions
function ProductsList() {
  const dataStore = new DataStore(new MemoryPlugin("app")); // New instance every render!

  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    [dataStore] // dataStore reference changes every render
  );
  // This causes useQuery's effect to re-run infinitely
}