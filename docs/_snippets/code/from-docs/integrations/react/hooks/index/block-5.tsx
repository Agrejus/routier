// ❌ One-time only - never updates
const products = useQuery(
  (callback) => dataStore.products.toArray(callback), // No .subscribe()
  []
);

// Adding products won't cause a re-render
await dataStore.products.addAsync({ name: "New Product" });
// Component stays the same