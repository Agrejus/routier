// Get user and make changes
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (user) {
  // Update basic properties
  user.firstName = "Johnny";
  user.lastName = "Smith";

  // Update nested objects
  user.address.street = "456 Oak Avenue";
  user.address.city = "New City";

  // Update arrays
  user.tags.push("premium");
  user.tags.push("verified");

  // All changes are tracked automatically
  console.log("User has been modified");

  // Note: Changes are still only in memory at this point
}