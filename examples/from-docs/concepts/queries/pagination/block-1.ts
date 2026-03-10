// Get first 10 items
const firstPage = await dataStore.products.take(10).toArrayAsync();

// Skip first 10, get next 10
const secondPage = await dataStore.products.skip(10).take(10).toArrayAsync();