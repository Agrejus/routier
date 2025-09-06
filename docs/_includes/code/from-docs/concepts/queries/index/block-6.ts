// Count
const count = await ctx.users.countAsync();

// Min/Max/Sum over a numeric projection
const minAge = await ctx.users.minAsync((u) => u.age);
const maxAge = await ctx.users.maxAsync((u) => u.age);
const totalAge = await ctx.users.sumAsync((u) => u.age);

// Distinct values: project first, then distinct
const distinctAges = await ctx.users.map((u) => u.age).distinctAsync();