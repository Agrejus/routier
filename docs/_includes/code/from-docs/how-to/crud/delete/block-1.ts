const user = await ctx.users.where((u) => u.id === userId).firstAsync();
if (user) {
  // Delete related data first
  await ctx.userSessions.where((s) => s.userId === userId).removeAsync();
  await ctx.userPreferences.where((p) => p.userId === userId).removeAsync();

  // Delete the user
  await ctx.users.removeAsync(user);
  await ctx.saveChangesAsync();
}