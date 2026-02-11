// Delete user and all related data
await ctx.userSessions.where((s) => s.userId === userId).removeAsync();
await ctx.userPosts.where((p) => p.userId === userId).removeAsync();
await ctx.users.removeAsync(user);