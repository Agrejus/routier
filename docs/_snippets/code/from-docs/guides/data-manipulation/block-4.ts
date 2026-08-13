const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Add items to array
  user.tags.push("premium");
  user.tags.push("verified");

  // Remove items by replacing the array
  user.tags = user.tags.filter((tag) => tag !== "temporary");

  // Modify array elements
  if (user.orders.length > 0) {
    user.orders[0].status = "shipped";
    user.orders[0].trackingNumber = "TRK123456";
  }

  await ctx.saveChangesAsync();
}