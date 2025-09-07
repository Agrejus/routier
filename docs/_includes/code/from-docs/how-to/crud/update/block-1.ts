const ctx = new AppContext();

// Get a user - this returns a proxy object
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (user) {
  // These changes are automatically tracked by the proxy
  user.name = "John Smith"; // Tracked
  user.age = 31; // Tracked
  user.profile.avatar = "new-avatar.jpg"; // Nested changes tracked

  // The entity knows it has been modified
  // No need to call any update methods

  // IMPORTANT: Changes are NOT persisted until saveChanges() is called
}