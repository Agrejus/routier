// Remove users with backup
async function removeUsersWithBackup(criteria: any) {
  const usersToRemove = await ctx.users
    .where((user) => user.status === criteria.status)
    .toArrayAsync();

  if (usersToRemove.length === 0) {
    return;
  }

  // Create backup before removal
  const backup = usersToRemove.map((user) => ({
    ...user,
    removedAt: new Date(),
    removedBy: "system",
    originalId: user.id,
  }));

  // Store backup (could be in a different collection or file)
  await ctx.userBackups.addAsync(...backup);

  // Remove users
  await ctx.users.removeAsync(...usersToRemove);

  console.log(`Removed ${usersToRemove.length} users with backup created`);
}