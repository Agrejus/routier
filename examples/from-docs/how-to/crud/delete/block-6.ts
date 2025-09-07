// Remove users with parameterized criteria
async function removeUsersByAgeRange(minAge: number, maxAge: number) {
  await ctx.users
    .where(
      (user, params) => user.age >= params.minAge && user.age <= params.maxAge,
      { minAge, maxAge }
    )
    .removeAsync();

  console.log(`Removed users between ${minAge} and ${maxAge} years old`);
}

// Usage
await removeUsersByAgeRange(13, 17); // Remove teenage users