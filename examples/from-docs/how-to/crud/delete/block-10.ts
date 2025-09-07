// Remove user and related data
async function removeUserCascading(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    console.log("User not found");
    return;
  }

  try {
    // Remove related orders
    const userOrders = await ctx.orders
      .where((order) => order.userId === userId)
      .toArrayAsync();

    if (userOrders.length > 0) {
      await ctx.orders.removeAsync(...userOrders);
      console.log(`Removed ${userOrders.length} orders`);
    }

    // Remove related profile
    const userProfile = await ctx.userProfiles.firstOrUndefinedAsync(
      (p) => p.userId === userId
    );

    if (userProfile) {
      await ctx.userProfiles.removeAsync(userProfile);
      console.log("Removed user profile");
    }

    // Remove user
    await ctx.users.removeAsync(user);
    console.log("User removed successfully");
  } catch (error) {
    console.error("Failed to remove user and related data:", error);
    throw error;
  }
}