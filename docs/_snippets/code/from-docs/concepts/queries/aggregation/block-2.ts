// Sum all product prices
const totalValue = await ctx.products.sumAsync((p) => p.price);

// Sum prices of electronics only
const electronicsTotal = await ctx.products
  .where((p) => p.category === "electronics")
  .sumAsync((p) => p.price);

// Sum prices of in-stock products
const inStockValue = await ctx.products
  .where((p) => p.inStock === true)
  .sumAsync((p) => p.price);