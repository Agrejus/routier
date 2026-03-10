// ✅ Use .subscribe() when data changes
function ProductsList() {
  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    []
  );
  // Automatically updates when products are added/updated/removed
}