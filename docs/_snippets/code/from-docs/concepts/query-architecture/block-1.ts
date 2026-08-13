// Simple filtering
const expensiveProducts = await dataStore.products
  .where((p) => p.price > 100)
  .toArrayAsync();

// Complex queries with multiple conditions
const electronicsInStock = await dataStore.products
  .where((p) => p.category === "electronics" && p.inStock === true)
  .sort((p) => p.price)
  .take(10)
  .toArrayAsync();

// String operations
const laptopProducts = await dataStore.products
  .where((p) => p.name.toLowerCase().includes("laptop"))
  .toArrayAsync();