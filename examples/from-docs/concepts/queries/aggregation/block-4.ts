// Get unique categories
const uniqueCategories = await ctx.products
  .map((p) => p.category)
  .distinctAsync();

// Get unique prices
const uniquePrices = await ctx.products.map((p) => p.price).distinctAsync();

// Get unique product names
const uniqueNames = await ctx.products.map((p) => p.name).distinctAsync();