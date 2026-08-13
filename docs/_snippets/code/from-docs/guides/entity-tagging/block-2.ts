await ctx.users.tag("system:sync").addAsync({
  name: "Sync Bot",
  email: "sync@example.com",
});
await ctx.saveChangesAsync();