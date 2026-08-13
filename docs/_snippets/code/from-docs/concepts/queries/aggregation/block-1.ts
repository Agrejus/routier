// Count all products
const totalCount = await ctx.products.countAsync();

// Count products in specific category
const electronicsCount = await ctx.products
  .where((p) => p.category === "electronics")
  .countAsync();

// Count products in stock
const inStockCount = await ctx.products
  .where((p) => p.inStock === true)
  .countAsync();