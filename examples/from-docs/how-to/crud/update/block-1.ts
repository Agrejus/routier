const user = await ctx.users.where((u) => u.id === userId).firstAsync();
if (user) {
  user.name = newData.name;
  user.email = newData.email;
  user.updatedAt = new Date();
  await ctx.saveChangesAsync();
}