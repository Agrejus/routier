// ✅ Good - use appropriate filters early
const activeUsers = await ctx.users
  .where((user) => user.status === "active") // Filter first
  .sort((user) => user.name) // Then sort
  .take(10) // Then limit
  .toArrayAsync();

// ❌ Avoid - sorting before filtering
const inefficientQuery = await ctx.users
  .sort((user) => user.name) // Sorting all users
  .where((user) => user.status === "active") // Then filtering
  .take(10) // Then limiting
  .toArrayAsync();