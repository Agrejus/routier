async function addProduct(product: Product) {
  // Optimistic add
  await dataStore.products.addAsync(product);
  await dataStore.saveChangesAsync();

  // Query automatically updates with new data
}