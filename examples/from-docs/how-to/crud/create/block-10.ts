async function createUserIfNotExists(userData: any) {
  // Check if user already exists
  const existingUser = await ctx.users.firstOrUndefinedAsync(
    (user) => user.email === userData.email
  );

  if (existingUser) {
    console.log("User already exists:", existingUser);
    return existingUser;
  }

  // Create new user
  const newUser = await ctx.users.addAsync(userData);
  console.log("New user created:", newUser);
  return newUser;
}

// Usage
const user = await createUserIfNotExists({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});