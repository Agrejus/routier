// Add a product
await dataStore.products.addAsync({ name: "New Product" });
await dataStore.saveChangesAsync();

// Component automatically re-renders with new data!