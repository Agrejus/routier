// ✅ Good - comprehensive error handling for actual errors
async function createUserSafely(userData: any) {
  try {
    const user = await ctx.users.addAsync(userData);
    console.log("User created successfully:", user);
    return user;
  } catch (error) {
    // Handle actual errors (network, database connection, etc.)
    if (error.message.includes("network")) {
      console.error("Network error occurred");
      // Handle network issues
    } else if (error.message.includes("database")) {
      console.error("Database error occurred");
      // Handle database issues
    } else {
      console.error("Unexpected error:", error);
      // Handle unexpected errors
    }

    throw error; // Re-throw for caller to handle
  }
}