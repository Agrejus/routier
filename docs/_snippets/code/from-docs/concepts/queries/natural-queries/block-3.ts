// Simple filter
const activeUsers = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

// Filter with parameters
const usersByName = await ctx.users
  .where((user, params) => user.name.startsWith(params.prefix), {
    prefix: "John",
  })
  .toArrayAsync();

// Multiple conditions
const filteredUsers = await ctx.users
  .where((user) => user.age >= 18 && user.status === "active")
  .toArrayAsync();