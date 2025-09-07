// Single sort
const sortedUsers = await ctx.users.sort((user) => user.name).toArrayAsync();

// Multiple sorts
const multiSorted = await ctx.users
  .sort((user) => user.age)
  .sort((user) => user.name)
  .toArrayAsync();

// Reverse sort
const reverseSorted = await ctx.users
  .sortDescending((user) => user.createdAt)
  .toArrayAsync();