// Complex expression that can't be parsed - falls back to memory filtering
const complex = await dataStore.products
  .where((p) => someComplexFunction(p) === true)
  .toArrayAsync();