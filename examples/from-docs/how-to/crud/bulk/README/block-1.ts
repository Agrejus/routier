const ctx = new AppContext();

// Add multiple users at once
const newUsers = await ctx.users.addAsync(
  {
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  },
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

console.log(`Added ${newUsers.length} users`);