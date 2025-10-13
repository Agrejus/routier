// Note: Routier does not validate required fields at runtime
// TypeScript will catch missing required fields at compile time
// This code will actually succeed and create a user with undefined name/email

const userWithMissingFields = await ctx.users.addAsync({
  // Missing required fields - TypeScript will warn about this
  age: 30,
  // name and email are required but missing
});

// The user will be created successfully with undefined values
// Use TypeScript's InferCreateType to get compile-time type checking