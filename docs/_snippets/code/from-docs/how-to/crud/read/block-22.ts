// ✅ Good - handle empty results
const users = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

if (users.length === 0) {
  console.log("No inactive users found");
  return;
}

console.log(`Found ${users.length} inactive users`);