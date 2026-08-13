// Analyze by category
const categoryAnalysis = await Promise.all(
  categories.map(async (category) => ({
    category,
    count: await ctx.products
      .where((p) => p.category === category)
      .countAsync(),
    totalValue: await ctx.products
      .where((p) => p.category === category)
      .sumAsync((p) => p.price),
  }))
);