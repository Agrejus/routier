// ✅ Good - logical order: filter → sort → paginate → transform
const result = await ctx.users
  .where((user) => user.status === "active") // Filter first
  .sort((user) => user.name) // Then sort
  .skip(10) // Then paginate
  .take(5) // Then limit
  .map((user) => ({ name: user.name })) // Finally transform
  .toArrayAsync();

// ❌ Avoid - inefficient order
const result = await ctx.users
  .sort((user) => user.name) // Sorting all users
  .map((user) => ({ name: user.name })) // Transforming all users
  .where((user) => user.status === "active") // Then filtering
  .skip(10) // Then paginating
  .take(5) // Then limiting
  .toArrayAsync();