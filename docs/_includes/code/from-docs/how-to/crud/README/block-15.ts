// Get and remove a user
const userToRemove = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (userToRemove) {
  await ctx.users.removeAsync(userToRemove);
}