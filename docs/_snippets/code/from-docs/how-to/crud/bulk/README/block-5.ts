// Update users based on conditions
const usersToUpdate = await ctx.users
  .where((user) => user.age < 18)
  .toArrayAsync();

// Apply different updates based on age
usersToUpdate.forEach((user) => {
  if (user.age < 13) {
    user.category = "child";
    user.requiresParentalConsent = true;
  } else {
    user.category = "teen";
    user.requiresParentalConsent = false;
  }

  user.lastCategoryUpdate = new Date();
});