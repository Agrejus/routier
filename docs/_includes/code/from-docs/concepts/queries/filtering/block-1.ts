// ⚠️ This works but selects ALL records first, then filters in memory - less efficient
const minPrice = 100;
const maxPrice = 500;
const products = await dataStore.products
  .where((p) => p.price >= minPrice && p.price <= maxPrice) // Selects all, filters in memory
  .toArrayAsync();