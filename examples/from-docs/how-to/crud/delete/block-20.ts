// ✅ Good - confirm important deletions
async function deleteUserWithConfirmation(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) return;

  const confirmed = confirm(
    `Are you sure you want to delete user "${user.name}" (${user.email})?`
  );

  if (confirmed) {
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();
    console.log("User deleted");
  }
}

// ❌ Avoid - silent deletions
// await ctx.users.removeAsync(user);