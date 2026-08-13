// Find minimum value
const youngestAge = await ctx.users.minAsync((user) => user.age);
console.log(`Youngest user age: ${youngestAge}`);

// Find maximum value
const oldestAge = await ctx.users.maxAsync((user) => user.age);
console.log(`Oldest user age: ${oldestAge}`);

// Min/Max with filtering
const activeUsersYoungestAge = await ctx.users
  .where((user) => user.status === "active")
  .minAsync((user) => user.age);

console.log(`Youngest active user age: ${activeUsersYoungestAge}`);