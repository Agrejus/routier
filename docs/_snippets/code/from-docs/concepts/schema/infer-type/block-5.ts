// ✅ Use InferCreateType for creation
async function createUser(data: CreateUser) {
  return await ctx.users.addAsync(data);
}

// ✅ Use InferType for existing entities
async function updateUser(user: User, updates: Partial<User>) {
  return await ctx.users.updateAsync(user, updates);
}