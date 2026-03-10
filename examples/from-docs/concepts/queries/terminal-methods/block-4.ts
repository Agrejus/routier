// Count all products
const totalCount = await ctx.products.countAsync();

// Count products in specific category
const electronicsCount = await ctx.products
  .where((p) => p.category === "electronics")
  .countAsync();

// Count expensive products
const expensiveCount = await ctx.products
  .where((p) => p.price > 100)
  .countAsync();