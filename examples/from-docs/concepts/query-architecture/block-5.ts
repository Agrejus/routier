// This gets translated to: SELECT id, name, price, category FROM products WHERE price > 100 AND category = 'electronics'
const optimized = await dataStore.products
  .where((p) => p.price > 100 && p.category === "electronics")
  .toArrayAsync();