// Get inventory summary
const inventorySummary = {
  totalProducts: await ctx.products.countAsync(),
  inStockProducts: await ctx.products
    .where((p) => p.inStock === true)
    .countAsync(),
  totalValue: await ctx.products
    .where((p) => p.inStock === true)
    .sumAsync((p) => p.price),
  categories: await ctx.products.map((p) => p.category).distinctAsync(),
};