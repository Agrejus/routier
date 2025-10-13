// Note: Routier does not enforce unique constraints at the application level
// The .distinct() modifier only creates database indexes
// Duplicate values will be allowed in memory and may cause issues at the database level

const duplicateUser = await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com", // This will be allowed even if another user has this email
  age: 30,
});

// The duplicate will be added successfully
// Database-level constraint enforcement depends on the plugin implementation