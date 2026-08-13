// Count all users
const totalUsers = await ctx.users.countAsync();
console.log(`Total users: ${totalUsers}`);

// Count filtered users
const activeUserCount = await ctx.users
  .where((user) => user.status === "active")
  .countAsync();

console.log(`Active users: ${activeUserCount}`);