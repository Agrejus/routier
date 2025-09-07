// Get first 10 users
const firstPage = await ctx.users.take(10).toArrayAsync();

// Get users 11-20
const secondPage = await ctx.users.skip(10).take(10).toArrayAsync();

// Get users 21-30
const thirdPage = await ctx.users.skip(20).take(10).toArrayAsync();