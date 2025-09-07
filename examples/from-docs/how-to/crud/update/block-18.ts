// ✅ Good - batch updates are more efficient
const usersToUpdate = await ctx.users
  .where((user) => user.status === "pending")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  user.status = "active";
  user.activatedAt = new Date();
});

await ctx.saveChangesAsync(); // Save all at once

// ❌ Avoid - saving after every update
for (const user of usersToUpdate) {
  user.status = "active";
  user.activatedAt = new Date();
  await ctx.saveChangesAsync(); // Inefficient
}