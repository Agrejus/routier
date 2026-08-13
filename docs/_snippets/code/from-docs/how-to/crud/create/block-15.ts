// ✅ Good - validate before creating
function validateUserData(userData: any) {
  if (!userData.name || userData.name.trim().length === 0) {
    throw new Error("Name is required");
  }

  if (!userData.email || !userData.email.includes("@")) {
    throw new Error("Valid email is required");
  }

  if (userData.age && (userData.age < 0 || userData.age > 150)) {
    throw new Error("Age must be between 0 and 150");
  }
}

// Usage
try {
  validateUserData(userData);
  const user = await ctx.users.addAsync(userData);
} catch (error) {
  console.error("Validation failed:", error.message);
}