// Sum numeric values
const totalAge = await ctx.users.sumAsync((user) => user.age);
console.log(`Total age: ${totalAge}`);

// Sum with filtering
const activeUsersTotalAge = await ctx.users
  .where((user) => user.status === "active")
  .sumAsync((user) => user.age);

console.log(`Active users total age: ${activeUsersTotalAge}`);