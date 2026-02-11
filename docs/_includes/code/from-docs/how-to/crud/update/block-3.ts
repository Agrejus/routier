const products = await ctx.products
  .where((p) => p.category === "electronics")
  .toArrayAsync();
products.forEach((product) => {
  product.price = product.price * 1.1; // 10% increase
});
await ctx.saveChangesAsync();