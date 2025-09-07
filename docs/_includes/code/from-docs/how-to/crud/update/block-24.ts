async function updateUserSafely(userId: string, updateData: any) {
  try {
    const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Apply updates
    Object.assign(user, updateData);
    user.updatedAt = new Date();

    // Save changes
    await ctx.saveChangesAsync();

    console.log("User updated successfully");
    return user;
  } catch (error) {
    console.error("Failed to update user:", error);

    // Check what changes were made before the error
    const changes = await ctx.previewChangesAsync();
    console.log("Partial changes:", changes);

    throw error;
  }
}