// Rollback deletions before saving
async function removeUsersWithRollback(userIds: string[]) {
  const removedUsers = [];

  try {
    // Remove users
    for (const userId of userIds) {
      const user = await ctx.users.firstOrUndefinedAsync(
        (u) => u.id === userId
      );
      if (user) {
        await ctx.users.removeAsync(user);
        removedUsers.push(user);
      }
    }

    // Check if we want to proceed
    const confirmed = confirm(`Remove ${removedUsers.length} users?`);

    if (confirmed) {
      await ctx.saveChangesAsync();
      console.log("Users removed successfully");
    } else {
      // Rollback by clearing the change tracker
      // Note: This is a simplified example - actual rollback depends on your setup
      console.log("Removal cancelled, changes rolled back");
    }
  } catch (error) {
    console.error("Failed to remove users:", error);
    throw error;
  }
}