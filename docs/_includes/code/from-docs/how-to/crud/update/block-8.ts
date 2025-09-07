// Update users based on different conditions
const usersToUpdate = await ctx.users
  .where((user) => user.age < 18)
  .toArrayAsync();

// Apply different updates based on age
usersToUpdate.forEach((user) => {
  if (user.age < 13) {
    user.category = "child";
    user.requiresParentalConsent = true;
    user.accessLevel = "restricted";
  } else {
    user.category = "teen";
    user.requiresParentalConsent = false;
    user.accessLevel = "limited";
  }

  user.lastCategoryUpdate = new Date();
  user.updatedBy = "system";
});

console.log(`Updated ${usersToUpdate.length} users with age-based categories`);