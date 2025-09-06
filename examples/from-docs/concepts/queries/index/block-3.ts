// Ascending
const byName = await ctx.users.sort((u) => u.name).toArrayAsync();

// Descending
const newest = await ctx.users
  .sortDescending((u) => u.createdAt)
  .toArrayAsync();

// Multi-sort (applies in order added)
const sorted = await ctx.users
  .sort((u) => u.lastName)
  .sort((u) => u.firstName)
  .toArrayAsync();