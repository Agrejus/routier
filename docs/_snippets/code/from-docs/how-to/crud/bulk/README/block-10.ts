// Perform multiple operations
async function bulkUserOperations() {
  const ctx = new AppContext();

  try {
    // 1. Add new users
    const newUsers = await ctx.users.addAsync(
      { name: "New User 1", email: "new1@example.com" },
      { name: "New User 2", email: "new2@example.com" }
    );

    // 2. Update existing users
    const existingUsers = await ctx.users
      .where((user) => user.status === "pending")
      .toArrayAsync();

    existingUsers.forEach((user) => {
      user.status = "active";
      user.activatedAt = new Date();
    });

    // 3. Remove old users
    const oldUsers = await ctx.users
      .where(
        (user) =>
          user.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )
      .toArrayAsync();

    await ctx.users.removeAsync(...oldUsers);

    // 4. Save all changes at once
    const result = await ctx.saveChangesAsync();
    console.log("Bulk operations completed:", result);
  } catch (error) {
    console.error("Bulk operations failed:", error);
  }
}