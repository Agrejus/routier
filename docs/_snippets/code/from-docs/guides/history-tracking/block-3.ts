// Get all history for a specific product
const productHistory = await ctx.productsHistory
  .where((p) => p.productId === "product-123")
  .sort((p) => p.createdDate)
  .toArrayAsync();

// Get the latest version for a single product
const latestForOne = await ctx.productsHistory
  .where((p) => p.productId === "product-123")
  .sort((p) => p.createdDate)
  .take(1)
  .toArrayAsync();