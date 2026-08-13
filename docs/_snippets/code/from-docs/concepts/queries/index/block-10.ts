// Complex query with multiple operations
const topExpensiveElectronics = await ctx.products
  .where((p) => p.category === "electronics")
  .where((p) => p.inStock === true)
  .orderByDescending((p) => p.price)
  .take(5)
  .map((p) => ({
    name: p.name,
    price: p.price,
    priceWithTax: p.price * 1.1,
  }))
  .toArrayAsync();