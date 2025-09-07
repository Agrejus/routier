// Remove users based on multiple conditions
await ctx.users
  .where(
    (user) =>
      user.status === "inactive" &&
      user.lastLogin < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  )
  .removeAsync();

console.log("Inactive users inactive for over 1 year removed");