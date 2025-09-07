// ✅ Good - handle related data before deletion
async function deleteUserWithCleanup(userId: string) {
  // Remove related data first
  await ctx.userOrders.where((order) => order.userId === userId).removeAsync();

  await ctx.userProfiles
    .where((profile) => profile.userId === userId)
    .removeAsync();

  // Then remove user
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
  if (user) {
    await ctx.users.removeAsync(user);
  }

  await ctx.saveChangesAsync();
}

// ❌ Avoid - leaving orphaned data
// await ctx.users.removeAsync(user);
// // Related orders and profiles are now orphaned