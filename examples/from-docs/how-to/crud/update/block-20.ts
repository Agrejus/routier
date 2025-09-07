// ✅ Good - let the proxy track changes automatically
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
if (user) {
  user.name = "New Name";
  user.email = "new@email.com";
  // Changes tracked automatically
}

// ❌ Avoid - manual change tracking
// user.markDirty();
// user.trackChange('name', 'New Name');