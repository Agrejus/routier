// ✅ Good - let the proxy track changes
const user = await ctx.users.firstOrUndefinedAsync((u) => u.name === "John");
if (user) {
  user.name = "Johnny"; // Automatically tracked
  user.age = 25; // Automatically tracked
}

// ❌ Avoid - manual change tracking
// user.markDirty();
// user.trackChange('name', 'Johnny');