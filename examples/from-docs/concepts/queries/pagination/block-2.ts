const expensiveProductsPage = await dataStore.products
  .where((p) => p.price > 100)
  .sort((p) => p.price)
  .skip(20)
  .take(10)
  .toArrayAsync();