try {
  const duplicateUser = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com", // Email must be unique
    age: 30,
  });
} catch (error) {
  console.error("Constraint validation failed:", error.message);
  // Output: Constraint validation failed: Email must be unique
}