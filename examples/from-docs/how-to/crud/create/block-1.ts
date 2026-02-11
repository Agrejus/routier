const newUser = await ctx.users.addAsync({
  name: userData.name,
  email: userData.email,
  passwordHash: await hashPassword(userData.password),
});
await ctx.saveChangesAsync();