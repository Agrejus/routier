// Only proceed if data exists
const hasData = await ctx.products.someAsync();
if (hasData) {
  const firstProduct = await ctx.products.firstAsync();
  // Process first product
}