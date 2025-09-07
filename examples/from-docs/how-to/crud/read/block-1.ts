const ctx = new AppContext();

// Get all users
const allUsers = await ctx.users.toArrayAsync();
console.log(`Found ${allUsers.length} users`);

// Get first user
const firstUser = await ctx.users.firstOrUndefinedAsync();
if (firstUser) {
  console.log("First user:", firstUser.name);
}

// Check if any users exist
const hasUsers = await ctx.users.someAsync();
console.log("Has users:", hasUsers);