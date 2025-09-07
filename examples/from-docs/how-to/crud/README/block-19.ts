const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (user) {
  // These changes are automatically tracked
  user.name = "John Smith"; // Tracked
  user.email = "john.smith@example.com"; // Tracked
  user.profile.avatar = "new-avatar.jpg"; // Nested changes tracked

  // The entity knows it has been modified
  // Changes are stored in the proxy
}