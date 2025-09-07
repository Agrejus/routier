// Sort by computed values
const usersByFullName = await ctx.users
  .sort((user) => `${user.firstName} ${user.lastName}`)
  .toArrayAsync();

// Sort by nested properties
const usersByCity = await ctx.users
  .sort((user) => user.address?.city || "")
  .toArrayAsync();

// Sort with custom comparison
const usersByStatus = await ctx.users
  .sort((user) => {
    const statusOrder = { active: 1, pending: 2, inactive: 3 };
    return statusOrder[user.status] || 4;
  })
  .toArrayAsync();