// All items
const all = await ctx.users.toArrayAsync();

// First item or undefined
const first = await ctx.users.firstOrUndefinedAsync();

// Does any record exist?
const hasAny = await ctx.users.someAsync();