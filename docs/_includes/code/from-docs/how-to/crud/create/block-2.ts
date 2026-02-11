const products = await ctx.products.addAsync(
  ...productData.map((p) => ({
    name: p.name,
    price: p.price,
    category: p.category,
    inStock: true,
  }))
);
await ctx.saveChangesAsync();