// Group products by category for display
const productsByCategory = await ctx.products.toGroupAsync((p) => p.category);

// Iterate over groups
for (const [category, products] of Object.entries(productsByCategory)) {
  console.log(`${category}: ${products.length} products`);
}

// Group with filtering
const activeProductsByStatus = await ctx.products
  .where((p) => p.active)
  .toGroupAsync((p) => p.status);