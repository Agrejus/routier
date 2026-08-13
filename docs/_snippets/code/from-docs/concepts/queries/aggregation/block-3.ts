// Get minimum price
const minPrice = await ctx.products.minAsync((p) => p.price);

// Get maximum price
const maxPrice = await ctx.products.maxAsync((p) => p.price);

// Get minimum price of electronics
const minElectronicsPrice = await ctx.products
  .where((p) => p.category === "electronics")
  .minAsync((p) => p.price);

// Get maximum price of in-stock products
const maxInStockPrice = await ctx.products
  .where((p) => p.inStock === true)
  .maxAsync((p) => p.price);