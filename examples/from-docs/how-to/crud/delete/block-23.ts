// ✅ Good - log deletion operations
async function deleteUserWithLogging(userId: string, reason: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) return;

  // Log the deletion
  await ctx.deletionLogs.addAsync({
    entityType: "user",
    entityId: userId,
    entityName: user.name,
    deletedAt: new Date(),
    deletedBy: "system",
    reason: reason,
  });

  // Perform deletion
  await ctx.users.removeAsync(user);
  await ctx.saveChangesAsync();

  console.log(`User "${user.name}" deleted. Reason: ${reason}`);
}