// Remove all inactive users
await ctx.users.where((u) => u.status === "inactive").removeAsync();