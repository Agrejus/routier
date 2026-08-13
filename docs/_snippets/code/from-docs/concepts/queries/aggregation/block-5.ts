// Check if any products exist
const hasProducts = await ctx.products.someAsync();

// Check if any expensive products exist
const hasExpensiveProducts = await ctx.products
  .where((p) => p.price > 1000)
  .someAsync();

// Check if all products are in stock
const allInStock = await ctx.products.everyAsync((p) => p.inStock);

// Check if all electronics are in stock
const allElectronicsInStock = await ctx.products
  .where((p) => p.category === "electronics")
  .everyAsync((p) => p.inStock === true);