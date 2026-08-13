// Good: Filter before aggregation
const expensiveCount = await ctx.products
  .where((p) => p.price > 100)
  .countAsync();

// Less efficient: Load all data then filter
const allProducts = await ctx.products.toArrayAsync();
const expensiveCount = allProducts.filter((p) => p.price > 100).length;