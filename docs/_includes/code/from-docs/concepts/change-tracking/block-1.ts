const product = await ctx.products.firstAsync();
product.price = 129.99; // tracked in memory

const result = await ctx.saveChangesAsync();
// result.aggregate.updates === 1