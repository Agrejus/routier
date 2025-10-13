// Note: Routier does not validate field types at runtime
// TypeScript will catch type mismatches at compile time
// This code will actually succeed and store the string value

const userWithWrongType = await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com",
  age: "thirty", // Should be number, not string - TypeScript will warn
});

// The user will be created successfully with age as a string
// Use TypeScript's InferCreateType to get compile-time type checking