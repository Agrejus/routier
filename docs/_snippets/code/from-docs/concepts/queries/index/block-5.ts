// Simple filtering
const expensiveProducts = await ctx.products
  .where((p) => p.price > 100)
  .toArrayAsync();

// Multiple filters
const activeElectronics = await ctx.products
  .where((p) => p.category === "electronics")
  .where((p) => p.inStock === true)
  .toArrayAsync();

// Parameterized filtering
const productsInRange = await ctx.products
  .where((p, params) => p.price >= params.min && p.price <= params.max, {
    min: 50,
    max: 200,
  })
  .toArrayAsync();