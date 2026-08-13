// Filter with parameters for dynamic queries
const usersByName = await ctx.users
  .where((user, params) => user.name.startsWith(params.prefix), {
    prefix: "John",
  })
  .toArrayAsync();

console.log(
  `Found ${usersByName.length} users with names starting with "John"`
);

// Complex parameterized filter
const usersByAgeRange = await ctx.users
  .where(
    (user, params) => user.age >= params.minAge && user.age <= params.maxAge,
    {
      minAge: 18,
      maxAge: 65,
    }
  )
  .toArrayAsync();

console.log(
  `Found ${usersByAgeRange.length} users between 18 and 65 years old`
);