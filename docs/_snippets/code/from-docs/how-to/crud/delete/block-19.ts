async function deleteUserWithRecovery(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  try {
    // Create recovery point
    const recoveryData = {
      originalUser: { ...user },
      deletedAt: new Date(),
      deletedBy: "system",
    };

    // Store recovery data
    await ctx.deletionRecovery.addAsync(recoveryData);

    // Proceed with deletion
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();

    console.log("User deleted with recovery data stored");
  } catch (error) {
    console.error("Failed to delete user:", error);

    // Clean up recovery data if deletion failed
    await ctx.deletionRecovery
      .where((r) => r.originalUser.id === userId)
      .removeAsync();

    throw error;
  }
}