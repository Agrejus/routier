// Update based on computed values
const usersToUpdate = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  // Compute age group
  user.ageGroup = user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior";

  // Compute profile completeness
  user.profileComplete = !!(user.avatar && user.bio && user.address);

  // Compute account age
  const accountAge = Date.now() - user.createdAt.getTime();
  user.accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

  // Compute verification status
  user.isFullyVerified =
    user.emailVerified && user.phoneVerified && user.idVerified;
});

console.log(`Updated ${usersToUpdate.length} users with computed values`);