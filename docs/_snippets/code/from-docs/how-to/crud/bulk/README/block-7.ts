// Get users to remove
const usersToRemove = await ctx.users
  .where((user) => user.status === "deleted")
  .toArrayAsync();

// Remove all at once
await ctx.users.removeAsync(...usersToRemove);
console.log(`Removed ${usersToRemove.length} deleted users`);