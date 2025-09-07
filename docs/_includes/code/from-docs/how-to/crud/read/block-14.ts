// Transform to simple values
const userNames = await ctx.users.map((user) => user.name).toArrayAsync();
console.log("User names:", userNames);

// Transform to objects
const userSummaries = await ctx.users
  .map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdult: user.age >= 18,
  }))
  .toArrayAsync();

console.log("User summaries:", userSummaries);

// Transform with computed values
const userStats = await ctx.users
  .map((user) => ({
    name: user.name,
    age: user.age,
    ageGroup: user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior",
    nameLength: user.name.length,
  }))
  .toArrayAsync();