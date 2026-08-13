// Group products by category
const productsByCategory = await ctx.products.toGroupAsync((p) => p.category);
// Result: { "electronics": Product[], "clothing": Product[], "books": Product[] }

// Group products by status
const productsByStatus = await ctx.products.toGroupAsync((p) => p.status);
// Result: { "active": Product[], "inactive": Product[] }

// Group with filtering
const expensiveByCategory = await ctx.products
  .where((p) => p.price > 100)
  .toGroupAsync((p) => p.category);

// Group by numeric field
const productsByPriceRange = await ctx.products.toGroupAsync((p) =>
  p.price < 50 ? "budget" : p.price < 200 ? "mid" : "premium"
);
// Result: { "budget": Product[], "mid": Product[], "premium": Product[] }