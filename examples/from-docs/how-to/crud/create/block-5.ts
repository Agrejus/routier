const userSchema = s
  .define("users", {
    id: s.string().key().identity(), // Auto-generated UUID
    email: s.string().distinct(),
    createdAt: s.date().identity(), // Auto-generated timestamp
    version: s.number().identity(), // Auto-incrementing number
  })
  .compile();

const newUser = await ctx.users.addAsync({
  email: "user@example.com",
});

console.log(newUser);
// Output: {
//   id: "uuid-v4-string",           // Auto-generated
//   email: "user@example.com",
//   createdAt: "2024-01-15T10:30:00.000Z", // Auto-generated
//   version: 1                      // Auto-generated
// }