// Analyze price ranges
const priceAnalysis = {
  minPrice: await ctx.products.minAsync((p) => p.price),
  maxPrice: await ctx.products.maxAsync((p) => p.price),
  totalValue: await ctx.products.sumAsync((p) => p.price),
  expensiveProducts: await ctx.products
    .where((p) => p.price > 100)
    .countAsync(),
};