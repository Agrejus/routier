// Soft delete instead of hard delete
async function softDeleteUser(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    console.log("User not found");
    return;
  }

  // Mark as deleted instead of removing
  user.status = "deleted";
  user.deletedAt = new Date();
  user.deletedBy = "system";
  user.isDeleted = true;

  // Keep the user but mark as deleted
  console.log("User soft deleted");
}