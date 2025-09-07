// ✅ Good - use specific methods for single results
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

// ❌ Avoid - getting array when you need one item
const users = await ctx.users
  .where((u) => u.email === "john@example.com")
  .take(1)
  .toArrayAsync();
const user = users[0];