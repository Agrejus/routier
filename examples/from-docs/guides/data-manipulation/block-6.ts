const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (user) {
  // Update simple properties
  user.firstName = "John";
  user.lastName = "Smith";

  // Update nested objects
  user.address.street = "456 Oak Avenue";
  user.address.city = "New York";

  // Modify arrays
  user.tags.push("premium");
  user.tags.push("verified");

  // Replace array entirely
  user.preferences = ["dark-theme", "notifications"];

  // All changes tracked in memory
  await ctx.saveChangesAsync(); // Persist to storage
}