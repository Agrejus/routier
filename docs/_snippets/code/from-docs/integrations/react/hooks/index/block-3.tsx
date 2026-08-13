// ✅ Live updates - return the query so useQuery can unsubscribe
const products = useQuery(
  (callback) => dataStore.products.subscribe().toArray(callback),
  []
);

// When you add a product, the component automatically updates
await dataStore.products.addAsync({ name: "New Product" });
await dataStore.saveChangesAsync();