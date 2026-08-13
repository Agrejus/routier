// Sort by price (ascending)
const productsByPrice = await ctx.products.sort((p) => p.price).toArrayAsync();

// Sort by price (descending)
const expensiveFirst = await ctx.products
  .orderByDescending((p) => p.price)
  .toArrayAsync();

// Multiple sort criteria
const sortedProducts = await ctx.products
  .sort((p) => p.category)
  .sort((p) => p.name)
  .toArrayAsync();