// Custom method that uses queries
async getActiveUsersAsync() {
  return this.where((u) => u.status === "active").toArrayAsync();
}

// Custom method that combines query and update
async deactivateInactiveUsersAsync() {
  const inactive = await this.where((u) => u.lastLogin < cutoffDate).toArrayAsync();
  inactive.forEach((user) => {
    user.status = "inactive";
  });
  return inactive;
}

// Use the extended collection normally
await ctx.users.addAsync({ name: "New User", email: "new@example.com" });
await ctx.users.getActiveUsersAsync();
await ctx.saveChangesAsync(); // Persist all changes