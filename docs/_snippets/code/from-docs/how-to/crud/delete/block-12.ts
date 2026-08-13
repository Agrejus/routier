// Remove users based on business rules
async function removeUsersByBusinessRules() {
  const usersToEvaluate = await ctx.users
    .where((user) => user.status === "pending")
    .toArrayAsync();

  const usersToRemove = [];

  for (const user of usersToEvaluate) {
    // Check business rules
    const shouldRemove =
      user.createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && // Older than 7 days
      !user.emailVerified && // Not verified
      !user.phoneVerified; // Not verified

    if (shouldRemove) {
      usersToRemove.push(user);
    }
  }

  if (usersToRemove.length > 0) {
    await ctx.users.removeAsync(...usersToRemove);
    console.log(
      `Removed ${usersToRemove.length} users based on business rules`
    );
  }
}