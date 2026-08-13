// Complex query with multiple operations
const premiumActiveUsers = await ctx.users
  .where((user) => user.status === "active")
  .where((user) => user.subscription === "premium")
  .sort((user) => user.lastLogin)
  .take(20)
  .map((user) => ({
    name: user.name,
    email: user.email,
    daysSinceLastLogin: Math.floor(
      (Date.now() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }))
  .toArrayAsync();

console.log("Premium active users:", premiumActiveUsers);