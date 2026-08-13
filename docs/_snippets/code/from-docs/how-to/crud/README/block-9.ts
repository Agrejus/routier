// Filter by condition
const activeUsers = await ctx.users
  .where((user) => user.age >= 18)
  .toArrayAsync();

// Filter with parameters
const usersByName = await ctx.users
  .where((user, params) => user.name.startsWith(params.prefix), {
    prefix: "John",
  })
  .toArrayAsync();

// Complex filters
const filteredUsers = await ctx.users
  .where((user) => user.age >= 18 && user.email.includes("@"))
  .toArrayAsync();