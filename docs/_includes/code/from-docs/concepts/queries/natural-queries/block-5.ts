// Transform data
const userNames = await ctx.users.map((user) => user.name).toArrayAsync();

// Complex transformation
const userSummaries = await ctx.users
  .map((user) => ({
    id: user.id,
    displayName: `${user.firstName} ${user.lastName}`,
    age: user.age,
    isAdult: user.age >= 18,
  }))
  .toArrayAsync();