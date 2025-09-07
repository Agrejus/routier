const ctx = new AppContext();

// Get user to remove
const userToRemove = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (userToRemove) {
  // Remove the user
  await ctx.users.removeAsync(userToRemove);
  console.log("User removed successfully");
}