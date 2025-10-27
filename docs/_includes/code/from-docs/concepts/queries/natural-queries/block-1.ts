// Good: parameterized value is known to the engine
const users = await ctx.users
  .where(([u, p]) => u.name.startsWith(p.prefix), { prefix: "Ja" })
  .toArrayAsync();

// Without parameters, Routier will load from the store then filter in memory
const slower = await ctx.users
  .where((u) => u.name.startsWith(prefix)) // prefix is not known at compile time
  .toArrayAsync();