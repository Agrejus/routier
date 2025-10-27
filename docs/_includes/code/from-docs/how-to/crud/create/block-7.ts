try {
  const invalidUser = await ctx.users.addAsync({
    // Missing required fields
    age: 30,
    // name and email are required but missing
  });
} catch (error) {
  console.error("Validation failed:", error.message);
  // Output: Validation failed: Required field 'name' is missing
}