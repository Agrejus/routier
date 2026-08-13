// Prepare array of entities
const usersToAdd = [
  { name: "User 1", email: "user1@example.com", age: 20 },
  { name: "User 2", email: "user2@example.com", age: 22 },
  { name: "User 3", email: "user3@example.com", age: 24 },
  // ... more users
];

// Add all at once
const addedUsers = await ctx.users.addAsync(...usersToAdd);
console.log(`Bulk added ${addedUsers.length} users`);