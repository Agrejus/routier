// Get only product names
const productNames = await dataStore.products.map((p) => p.name).toArrayAsync();

// Get only prices
const productPrices = await dataStore.products
  .map((p) => p.price)
  .toArrayAsync();