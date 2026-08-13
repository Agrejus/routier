// Good - leverage TypeScript inference
const user = await ctx.users.addAsync({
  name: "John",
  email: "john@example.com",
  // TypeScript will catch missing required fields
});

// Good - use inferred types
type User = InferType<typeof userSchema>;
function processUser(user: User) { ... }