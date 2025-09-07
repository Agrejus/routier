try {
  const invalidUser = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
    age: "thirty", // Should be number, not string
  });
} catch (error) {
  console.error("Type validation failed:", error.message);
  // Output: Type validation failed: Expected number for field 'age'
}