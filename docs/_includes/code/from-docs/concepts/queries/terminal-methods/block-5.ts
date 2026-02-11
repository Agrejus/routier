// Sum all product prices
const totalValue = await ctx.products.sumAsync((p) => p.price);

// Sum prices of electronics
const electronicsValue = await ctx.products
  .where((p) => p.category === "electronics")
  .sumAsync((p) => p.price);

// Get minimum price
const minPrice = await ctx.products.minAsync((p) => p.price);

// Get maximum price
const maxPrice = await ctx.products.maxAsync((p) => p.price);

// Get minimum price of electronics
const minElectronicsPrice = await ctx.products
  .where((p) => p.category === "electronics")
  .minAsync((p) => p.price);