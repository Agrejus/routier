try {
  const user = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
  });

  await ctx.saveChangesAsync();
  console.log("User created successfully:", user);
} catch (error) {
  console.error("Failed to create user:", error);
  // Handle error appropriately
}