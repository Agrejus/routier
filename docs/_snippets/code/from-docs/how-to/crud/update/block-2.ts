const orders = await ctx.orders
  .where((o) => o.status === "pending")
  .toArrayAsync();
orders.forEach((order) => {
  order.status = "processing";
  order.processedAt = new Date();
});
await ctx.saveChangesAsync();