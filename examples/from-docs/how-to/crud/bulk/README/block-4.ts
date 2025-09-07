// Get users to update
const usersToUpdate = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

// Update all users in batch
usersToUpdate.forEach((user) => {
  user.status = "active";
  user.lastActivated = new Date();
  user.activationCount = (user.activationCount || 0) + 1;
});

// All changes are tracked automatically
console.log(`Updated ${usersToUpdate.length} users`);