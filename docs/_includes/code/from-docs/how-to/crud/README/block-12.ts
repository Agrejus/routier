// Get a user
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (user) {
  // Update properties directly - changes are tracked automatically
  user.name = "John Smith";
  user.age = 31;

  // The entity tracks its own changes via the proxy
  // No need to call any update methods
}