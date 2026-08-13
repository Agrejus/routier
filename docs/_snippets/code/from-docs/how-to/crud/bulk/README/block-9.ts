// Get users to remove
const usersToRemove = await ctx.users
  .where((user) => user.status === "suspended")
  .toArrayAsync();

if (usersToRemove.length > 0) {
  console.log(`About to remove ${usersToRemove.length} suspended users`);

  // Confirm removal
  const confirmed = confirm(`Remove ${usersToRemove.length} suspended users?`);

  if (confirmed) {
    await ctx.users.removeAsync(...usersToRemove);
    console.log("Suspended users removed");
  }
}