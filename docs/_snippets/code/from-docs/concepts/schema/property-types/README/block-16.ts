// Good - TypeScript will infer the correct type
const user = await ctx.users.addAsync({
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

// TypeScript knows user.firstName is string