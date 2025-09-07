// Count
const userCount = await ctx.users.countAsync();

// Sum
const totalAge = await ctx.users.sumAsync((user) => user.age);

// Min/Max
const youngestAge = await ctx.users.minAsync((user) => user.age);
const oldestAge = await ctx.users.maxAsync((user) => user.age);

// Distinct values
const uniqueAges = await ctx.users.distinctAsync((user) => user.age);