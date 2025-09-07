// Sort by name
const sortedUsers = await ctx.users.sort((user) => user.name).toArrayAsync();

// Sort by multiple fields
const multiSorted = await ctx.users
  .sort((user) => user.age)
  .sort((user) => user.name)
  .toArrayAsync();

// Pagination
const paginatedUsers = await ctx.users
  .sort((user) => user.name)
  .skip(10)
  .take(5)
  .toArrayAsync();