// Transform data - reshape entities
const summaries = await ctx.products
  .map((p) => ({ name: p.name, price: p.price }))
  .toArrayAsync();

// Aggregate data - calculate totals
const total = await ctx.products
  .where((p) => p.inStock)
  .sumAsync((p) => p.price);

// Combine operations - filter, sort, and transform
const results = await ctx.products
  .where((p) => p.category === "electronics")
  .sort((p) => p.price)
  .map((p) => ({ id: p.id, name: p.name }))
  .toArrayAsync();