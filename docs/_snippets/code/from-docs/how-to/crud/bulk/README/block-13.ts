// Clear references after bulk operations
async function bulkOperationWithCleanup() {
  const ctx = new AppContext();

  try {
    // Perform bulk operations
    const usersToUpdate = await ctx.users
      .where((user) => user.status === "pending")
      .toArrayAsync();

    usersToUpdate.forEach((user) => {
      user.status = "active";
    });

    await ctx.saveChangesAsync();

    // Clear references to free memory
    usersToUpdate.length = 0;
  } catch (error) {
    console.error("Operation failed:", error);
  }
}