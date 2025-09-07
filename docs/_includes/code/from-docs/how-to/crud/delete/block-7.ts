// Remove users by different statuses
async function cleanupUsersByStatus() {
  const statusesToRemove = ["deleted", "suspended", "banned"];

  for (const status of statusesToRemove) {
    const usersToRemove = await ctx.users
      .where((user) => user.status === status)
      .toArrayAsync();

    if (usersToRemove.length > 0) {
      await ctx.users.removeAsync(...usersToRemove);
      console.log(
        `Removed ${usersToRemove.length} users with status: ${status}`
      );
    }
  }
}

await cleanupUsersByStatus();