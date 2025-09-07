// Get unique values
const uniqueAges = await ctx.users.distinctAsync((user) => user.age);
console.log("Unique ages:", uniqueAges);

// Get unique cities
const uniqueCities = await ctx.users.distinctAsync(
  (user) => user.address?.city
);
console.log("Unique cities:", uniqueCities);