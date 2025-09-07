// Update array properties
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Add to arrays
  user.tags.push("premium");
  user.tags.push("verified");

  // Remove from arrays
  user.tags = user.tags.filter((tag) => tag !== "temporary");

  // Replace entire arrays
  user.preferences = ["dark-theme", "notifications", "analytics"];

  // Update array elements
  if (user.orders.length > 0) {
    user.orders[0].status = "shipped";
    user.orders[0].trackingNumber = "TRK123456";
  }

  // All array changes are tracked
  console.log("Arrays updated");
}