// Update multiple users
const usersToUpdate = await ctx.users
  .where((user) => user.age < 18)
  .toArrayAsync();

// Update each user
usersToUpdate.forEach((user) => {
  user.status = "minor";
  user.requiresParentalConsent = true;
});