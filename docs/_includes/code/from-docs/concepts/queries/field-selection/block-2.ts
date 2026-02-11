const expensiveProductNames = await dataStore.products
  .where((p) => p.price > 100)
  .sortDescending((p) => p.price)
  .map((p) => p.name)
  .toArrayAsync();