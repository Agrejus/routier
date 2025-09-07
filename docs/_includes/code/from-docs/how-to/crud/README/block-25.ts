// ✅ Good - batch operations are more efficient
const users = await ctx.users.addAsync(
  { name: "User 1" },
  { name: "User 2" },
  { name: "User 3" }
);

// ❌ Avoid - multiple individual operations
const user1 = await ctx.users.addAsync({ name: "User 1" });
const user2 = await ctx.users.addAsync({ name: "User 2" });
const user3 = await ctx.users.addAsync({ name: "User 3" });