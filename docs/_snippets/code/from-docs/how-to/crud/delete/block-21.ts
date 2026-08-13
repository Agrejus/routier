// ✅ Good - use query-based removal for multiple entities
await ctx.users.where((user) => user.status === "deleted").removeAsync();

// ✅ Good - use individual removal for specific entities
await ctx.users.removeAsync(specificUser);

// ❌ Avoid - mixing approaches unnecessarily
const users = await ctx.users
  .where((u) => u.status === "deleted")
  .toArrayAsync();
for (const user of users) {
  await ctx.users.removeAsync(user); // Less efficient
}