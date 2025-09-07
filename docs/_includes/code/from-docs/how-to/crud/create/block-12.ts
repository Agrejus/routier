const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    firstName: s.string(),
    lastName: s.string(),
    fullName: s
      .string()
      .computed((user) => `${user.firstName} ${user.lastName}`),
    email: s.string().distinct(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

const newUser = await ctx.users.addAsync({
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
});

console.log(newUser.fullName); // "John Doe" - computed automatically