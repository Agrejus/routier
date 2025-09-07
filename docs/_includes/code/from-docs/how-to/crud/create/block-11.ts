async function createUsersWithValidation(usersData: any[]) {
  const validUsers = [];
  const invalidUsers = [];

  for (const userData of usersData) {
    try {
      // Validate data before adding
      if (!userData.name || !userData.email) {
        invalidUsers.push({
          data: userData,
          reason: "Missing required fields",
        });
        continue;
      }

      if (userData.age && (userData.age < 0 || userData.age > 150)) {
        invalidUsers.push({ data: userData, reason: "Invalid age" });
        continue;
      }

      validUsers.push(userData);
    } catch (error) {
      invalidUsers.push({ data: userData, reason: error.message });
    }
  }

  // Add all valid users
  if (validUsers.length > 0) {
    const addedUsers = await ctx.users.addAsync(...validUsers);
    console.log(`Added ${addedUsers.length} valid users`);
  }

  if (invalidUsers.length > 0) {
    console.warn(`${invalidUsers.length} users were invalid:`, invalidUsers);
  }

  return { validUsers, invalidUsers };
}

// Usage
const usersData = [
  { name: "John", email: "john@example.com", age: 30 },
  { name: "Jane", email: "jane@example.com" }, // Missing age
  { name: "Bob", email: "bob@example.com", age: 200 }, // Invalid age
  { email: "alice@example.com", age: 25 }, // Missing name
];

const result = await createUsersWithValidation(usersData);