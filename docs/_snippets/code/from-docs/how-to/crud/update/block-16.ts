// Updates are validated against the schema
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  try {
    // This will be validated against the schema
    user.age = "invalid-age"; // Should be number
  } catch (error) {
    console.error("Validation failed:", error.message);
    // The change won't be tracked if it's invalid
  }
}