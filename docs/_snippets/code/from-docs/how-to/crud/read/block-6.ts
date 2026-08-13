// Sort by single field
const sortedUsers = await ctx.users.sort((user) => user.name).toArrayAsync();

// Sort by multiple fields (order matters)
const multiSortedUsers = await ctx.users
  .sort((user) => user.age) // Primary sort: age
  .sort((user) => user.name) // Secondary sort: name
  .toArrayAsync();

// Sort in descending order
const reverseSortedUsers = await ctx.users
  .sort((user) => user.createdAt, "desc")
  .toArrayAsync();