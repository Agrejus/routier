// Get first product (throws if none exist)
const firstProduct = await ctx.products.firstAsync();

// Get first product or undefined if none exist
const firstOrUndefined = await ctx.products.firstOrUndefinedAsync();

// Get first expensive product
const firstExpensive = await ctx.products
  .where((p) => p.price > 100)
  .firstOrUndefinedAsync();