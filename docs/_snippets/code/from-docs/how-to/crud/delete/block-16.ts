// ✅ Good - batch deletion is more efficient
const usersToRemove = await ctx.users
  .where((user) => user.status === "deleted")
  .toArrayAsync();

await ctx.users.removeAsync(...usersToRemove);
await ctx.saveChangesAsync(); // Save all at once

// ❌ Avoid - individual deletion and saving
for (const user of usersToRemove) {
  await ctx.users.removeAsync(user);
  await ctx.saveChangesAsync(); // Inefficient
}