// Remove all users matching criteria
await ctx.users
  .where(
    (user) => user.lastLogin < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  )
  .removeAsync();

console.log("Removed users inactive for over 1 year");