const james = await ctx.users
  .where((u) => u.name === "James")
  .firstOrUndefinedAsync();