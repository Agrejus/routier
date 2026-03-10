// Remove all products
await ctx.products.removeAsync();

// Remove expensive products
await ctx.products.where((p) => p.price > 100).removeAsync();

// Remove products in specific category
await ctx.products.where((p) => p.category === "electronics").removeAsync();

// Remove out of stock products
await ctx.products.where((p) => p.inStock === false).removeAsync();