// Count
const userCount = await ctx.users.countAsync();

// Sum
const totalAge = await ctx.users.sumAsync((user) => user.age);

// Min/Max
const youngestAge = await ctx.users.minAsync((user) => user.age);
const oldestAge = await ctx.users.maxAsync((user) => user.age);

// Distinct values
// Distinct operates on the current shape. Project the field first:
const uniqueAges = await ctx.users.map((user) => user.age).distinctAsync();