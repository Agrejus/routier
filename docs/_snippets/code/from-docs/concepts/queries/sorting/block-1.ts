// Sort by category first, then by price
const productsByCategoryAndPrice = await dataStore.products
  .sort((p) => p.category)
  .sort((p) => p.price)
  .toArrayAsync();