// Batch multiple changes for efficient syncing
await dataStore.products.addAsync(product1, product2, product3);
await dataStore.products.updateAsync(update1, update2);
await dataStore.saveChangesAsync(); // Single sync operation