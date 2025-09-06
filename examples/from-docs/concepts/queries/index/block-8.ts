// Good: DB filter first, then computed filter (runs remaining in memory)
const found = await ctx.userProfiles
  .where((u) => u.firstName.startsWith("A")) // database-backed
  .where((u) => u.age === 0) // computed (in-memory)
  .firstOrUndefinedAsync();

// Avoid: starting with a computed filter can lead to a broader load before filtering in memory
const avoid = await ctx.userProfiles
  .where((u) => u.age === 0) // computed (in-memory)
  .where((u) => u.firstName.startsWith("A")) // database-backed
  .toArrayAsync();