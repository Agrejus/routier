async function safeBulkOperation() {
  const ctx = new AppContext();

  try {
    // Start transaction-like operation
    const usersToAdd = generateUsers(100);
    const usersToUpdate = await ctx.users
      .where((user) => user.status === "pending")
      .toArrayAsync();

    // Add new users
    await ctx.users.addAsync(...usersToAdd);

    // Update existing users
    usersToUpdate.forEach((user) => {
      user.status = "active";
    });

    // Save all changes
    await ctx.saveChangesAsync();

    console.log("Bulk operation completed successfully");
  } catch (error) {
    console.error("Bulk operation failed:", error);

    // Check what changes were made before the error
    const changes = await ctx.previewChangesAsync();
    console.log("Partial changes:", changes);

    // You might want to rollback or handle partial success
    throw error;
  }
}