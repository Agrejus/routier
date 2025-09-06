const page1 = await ctx.users.skip(0).take(10).toArrayAsync();
const page2 = await ctx.users.skip(10).take(10).toArrayAsync();