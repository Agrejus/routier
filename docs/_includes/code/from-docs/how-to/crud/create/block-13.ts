// ✅ Good - batch creation is more efficient
const users = await ctx.users.addAsync(
  { name: "User 1", email: "user1@example.com" },
  { name: "User 2", email: "user2@example.com" },
  { name: "User 3", email: "user3@example.com" }
);

// ❌ Avoid - individual creation is less efficient
const user1 = await ctx.users.addAsync({
  name: "User 1",
  email: "user1@example.com",
});
const user2 = await ctx.users.addAsync({
  name: "User 2",
  email: "user2@example.com",
});
const user3 = await ctx.users.addAsync({
  name: "User 3",
  email: "user3@example.com",
});