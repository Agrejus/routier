// Note: Routier does not validate field types at runtime
// TypeScript will catch type mismatches at compile time
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // This will succeed - Routier doesn't validate types at runtime
  user.age = "invalid-age"; // Should be number - TypeScript will warn

  // The change will be tracked and saved successfully
  // Use TypeScript's InferType to get compile-time type checking
}