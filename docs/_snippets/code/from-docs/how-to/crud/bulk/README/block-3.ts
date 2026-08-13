// Generate test data
const generateUsers = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + (i % 40), // Ages 20-59
    status: i % 2 === 0 ? "active" : "inactive",
  }));
};

// Bulk add 100 users
const testUsers = generateUsers(100);
const addedUsers = await ctx.users.addAsync(...testUsers);
console.log(`Generated and added ${addedUsers.length} test users`);