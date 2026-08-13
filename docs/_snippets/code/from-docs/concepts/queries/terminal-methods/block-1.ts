// Get all products
const allProducts = await ctx.products.toArrayAsync();

// Get all products with filtering
const expensiveProducts = await ctx.products
  .where((p) => p.price > 100)
  .toArrayAsync();