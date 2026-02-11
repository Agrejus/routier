// Check if any products exist
const hasProducts = await ctx.products.someAsync();

// Check if all products are in stock
const allInStock = await ctx.products.everyAsync((p) => p.inStock);