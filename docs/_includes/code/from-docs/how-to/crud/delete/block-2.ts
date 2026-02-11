// Remove old sessions
const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
await ctx.sessions.where((s) => s.lastActivity < cutoffDate).removeAsync();

// Remove inactive users
await ctx.users
  .where((u) => u.isActive === false && u.lastLogin < cutoffDate)
  .removeAsync();

await ctx.saveChangesAsync();