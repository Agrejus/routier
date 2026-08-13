// Remove multiple users
const usersToRemove = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

await ctx.users.removeAsync(...usersToRemove);