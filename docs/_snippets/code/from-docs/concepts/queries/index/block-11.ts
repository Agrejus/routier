// Good: Database-backed filter first
const expensiveElectronics = await ctx.products
  .where((p) => p.category === "electronics") // Database filter
  .where((p) => p.isExpensive === true) // Computed filter
  .toArrayAsync();

// Less efficient: Computed filter first
const allExpensive = await ctx.products
  .where((p) => p.isExpensive === true) // Loads all records
  .where((p) => p.category === "electronics") // Then filters
  .toArrayAsync();