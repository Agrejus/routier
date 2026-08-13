// Trigger view computation manually (callback-based)
ctx.productsView.compute((result) => {
  if (result.ok === "success") {
    console.log("View computed successfully");
  }
});

// Trigger view computation manually (async)
await ctx.productsView.computeAsync();