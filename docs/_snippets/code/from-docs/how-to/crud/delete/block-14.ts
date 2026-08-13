// Remove users and save changes
async function removeUsersAndSave(userIds: string[]) {
  for (const userId of userIds) {
    const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
    if (user) {
      await ctx.users.removeAsync(user);
    }
  }

  // Save all deletion changes
  const result = await ctx.saveChangesAsync();
  console.log("Deletion changes saved:", result);
}