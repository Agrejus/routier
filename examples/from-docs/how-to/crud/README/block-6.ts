// Add multiple users at once
const newUsers = await ctx.users.addAsync(
  {
    name: "Jane Smith",
    email: "jane@example.com",
    age: 25,
  },
  {
    name: "Bob Johnson",
    email: "bob@example.com",
    age: 35,
  }
);

console.log(newUsers); // Array of users with generated IDs