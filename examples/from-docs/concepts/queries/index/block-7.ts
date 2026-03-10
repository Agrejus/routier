// Select specific fields to reduce data transfer
const productSummaries = await ctx.products
  .map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
  }))
  .toArrayAsync();

// Create computed fields on-the-fly
const productsWithTax = await ctx.products
  .map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    priceWithTax: p.price * 1.1,
  }))
  .toArrayAsync();