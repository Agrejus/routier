// ✅ Good - comprehensive error handling
async function createUserSafely(userData: any) {
  try {
    const user = await ctx.users.addAsync(userData);
    console.log("User created successfully:", user);
    return user;
  } catch (error) {
    if (error.message.includes("unique")) {
      console.error("User with this email already exists");
      // Handle duplicate gracefully
    } else if (error.message.includes("required")) {
      console.error("Missing required fields");
      // Handle validation errors
    } else {
      console.error("Unexpected error:", error);
      // Handle unexpected errors
    }

    throw error; // Re-throw for caller to handle
  }
}