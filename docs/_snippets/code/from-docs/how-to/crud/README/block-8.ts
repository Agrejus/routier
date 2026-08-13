// Get all users
const allUsers = await ctx.users.toArrayAsync();

// Get first user
const firstUser = await ctx.users.firstOrUndefinedAsync();

// Check if any users exist
const hasUsers = await ctx.users.someAsync();