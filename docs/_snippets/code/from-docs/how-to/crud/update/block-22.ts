// ✅ Good - validate before updating
async function safeUpdate(userId: string, updateData: any) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Validate update data
  if (updateData.email && !updateData.email.includes("@")) {
    throw new Error("Invalid email format");
  }

  if (updateData.age && (updateData.age < 0 || updateData.age > 150)) {
    throw new Error("Invalid age");
  }

  // Apply updates
  Object.assign(user, updateData);
  user.updatedAt = new Date();

  await ctx.saveChangesAsync();
}

// ❌ Avoid - updating without validation
// user.email = invalidEmail;
// user.age = -5;