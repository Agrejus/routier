// Simple filter
const james = await ctx.users.where((u) => u.name === "James").toArrayAsync();

// Parameterized filter
const withPrefix = await ctx.users
  .where((u, p) => u.name.startsWith(p.prefix), { prefix: "Ja" })
  .toArrayAsync();