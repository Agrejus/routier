// Remove all users matching a condition
await ctx.users.where((user) => user.age < 13).removeAsync();