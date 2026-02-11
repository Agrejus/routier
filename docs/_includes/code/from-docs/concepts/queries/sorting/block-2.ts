const expensiveProductsSorted = await dataStore.products
  .where((p) => p.price > 100)
  .orderByDescending((p) => p.price)
  .toArrayAsync();