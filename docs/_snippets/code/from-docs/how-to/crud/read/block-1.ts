// This query chain doesn't execute until toArrayAsync() is called
const results = await dataStore.products
  .where((p) => p.price > 100)
  .sort((p) => p.name)
  .skip(10)
  .take(5)
  .toArrayAsync();