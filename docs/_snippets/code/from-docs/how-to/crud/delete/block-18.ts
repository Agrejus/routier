async function safeDeleteUser(userId: string) {
  try {
    const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user can be deleted
    if (user.status === "admin") {
      throw new Error("Cannot delete admin users");
    }

    if (user.hasActiveOrders) {
      throw new Error("Cannot delete user with active orders");
    }

    // Proceed with deletion
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();

    console.log("User deleted successfully");
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw error;
  }
}