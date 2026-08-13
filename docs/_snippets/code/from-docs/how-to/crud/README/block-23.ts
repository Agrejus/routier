// ✅ Good - async/await is cleaner
const user = await ctx.users.addAsync({ name: "John" });

// ❌ Avoid - callback-based API is more verbose
ctx.users.add({ name: "John" }, (result, error) => {
  // Handle result
});