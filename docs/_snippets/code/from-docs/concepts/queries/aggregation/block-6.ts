// Get statistics for electronics
const electronicsStats = {
  count: await ctx.products
    .where((p) => p.category === "electronics")
    .countAsync(),
  totalValue: await ctx.products
    .where((p) => p.category === "electronics")
    .sumAsync((p) => p.price),
  minPrice: await ctx.products
    .where((p) => p.category === "electronics")
    .minAsync((p) => p.price),
  maxPrice: await ctx.products
    .where((p) => p.category === "electronics")
    .maxAsync((p) => p.price),
};

// Get average price (sum / count)
const totalValue = await ctx.products.sumAsync((p) => p.price);
const totalCount = await ctx.products.countAsync();
const averagePrice = totalValue / totalCount;