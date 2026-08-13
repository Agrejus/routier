// Custom validation before updates
async function updateUserStatus(userId: string, newStatus: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Business logic validation
  if (newStatus === "suspended" && user.role === "admin") {
    throw new Error("Cannot suspend admin users");
  }

  if (newStatus === "premium" && user.subscriptionLevel === "free") {
    throw new Error("Free users cannot have premium status");
  }

  // Update if validation passes
  user.status = newStatus;
  user.statusUpdatedAt = new Date();
  user.statusUpdatedBy = "system";

  await ctx.saveChangesAsync();
  console.log("User status updated successfully");
}