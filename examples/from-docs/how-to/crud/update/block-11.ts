// Increment counters and timestamps
const usersToUpdate = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  // Increment counters
  user.loginCount = (user.loginCount || 0) + 1;
  user.viewCount = (user.viewCount || 0) + 1;

  // Update timestamps
  user.lastLogin = new Date();
  user.lastActivity = new Date();

  // Increment version
  user.version = (user.version || 0) + 1;
});

console.log(`Incremented counters for ${usersToUpdate.length} users`);