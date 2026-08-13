await ctx.users.tag("ui:clicked:add-user").addAsync({
  name: "James",
  email: "james.demeuse@gmail.com",
});
await ctx.saveChangesAsync();