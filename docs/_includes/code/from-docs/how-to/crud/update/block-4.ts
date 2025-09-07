// Update multiple properties at once
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Update multiple properties
  user.firstName = "John";
  user.lastName = "Smith";
  user.email = "john.smith@example.com";
  user.phone = "+1-555-0123";
  user.status = "active";

  // All changes are tracked
  console.log("Multiple properties updated");
}