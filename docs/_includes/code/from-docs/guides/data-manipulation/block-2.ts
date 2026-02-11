const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Direct property updates - automatically tracked
  user.name = "John Smith";
  user.age = 31;
  user.email = "john@example.com";

  // Changes tracked, but not yet persisted
  await ctx.saveChangesAsync(); // Now saved to storage
}