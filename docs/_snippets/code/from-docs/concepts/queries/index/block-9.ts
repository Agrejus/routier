// Sum prices of in-stock products
const totalValue = await ctx.products
  .where((p) => p.inStock === true)
  .sumAsync((p) => p.price);

// Get minimum and maximum prices
const minPrice = await ctx.products.minAsync((p) => p.price);
const maxPrice = await ctx.products.maxAsync((p) => p.price);

// Get distinct categories
const categories = await ctx.products.map((p) => p.category).distinctAsync();