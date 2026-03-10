const sortedProductsPage = await dataStore.products
  .sortDescending((p) => p.price)
  .skip(0)
  .take(5)
  .toArrayAsync();