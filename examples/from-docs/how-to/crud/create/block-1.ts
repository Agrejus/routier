const ctx = new AppContext();

// Add a single user
const newUser = await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

console.log(newUser);
// Output: { id: "generated-uuid", name: "John Doe", email: "john@example.com", age: 30 }