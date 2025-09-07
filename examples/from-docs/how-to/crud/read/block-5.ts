// Filter with string operations
const usersWithLongNames = await ctx.users
  .where((user) => user.name.length > 10)
  .toArrayAsync();

// Filter with date operations
const recentUsers = await ctx.users
  .where(
    (user) => user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  )
  .toArrayAsync();

// Filter with array operations
const usersWithTags = await ctx.users
  .where((user) => user.tags && user.tags.includes("premium"))
  .toArrayAsync();

// Filter with nested object properties
const usersInCity = await ctx.users
  .where((user) => user.address?.city === "New York")
  .toArrayAsync();