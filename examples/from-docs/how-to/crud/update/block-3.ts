const ctx = new AppContext();

// Get user and update
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (user) {
  // Simple property update
  user.name = "John Smith";
  user.age = 31;

  // Changes are tracked automatically
  console.log("User updated:", user.name);
}