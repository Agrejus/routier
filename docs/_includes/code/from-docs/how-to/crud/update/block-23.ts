// ✅ Good - clear update patterns
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
if (user) {
  // Clear what's being updated
  user.profile = {
    ...user.profile,
    ...profileUpdates,
    updatedAt: new Date(),
  };

  // Clear metadata
  user.lastProfileUpdate = new Date();
  user.profileUpdateCount = (user.profileUpdateCount || 0) + 1;
}

// ❌ Avoid - unclear updates
// Object.assign(user, randomData);
// user.randomField = randomValue;