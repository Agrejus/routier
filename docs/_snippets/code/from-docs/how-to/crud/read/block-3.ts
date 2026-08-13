// Filter by single condition
const activeUsers = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

console.log(`Found ${activeUsers.length} active users`);

// Filter by multiple conditions
const adultActiveUsers = await ctx.users
  .where((user) => user.age >= 18 && user.status === "active")
  .toArrayAsync();

console.log(`Found ${adultActiveUsers.length} adult active users`);