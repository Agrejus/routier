// Check if user exists before creating
const userExists = await ctx.users.where((u) => u.email === email).someAsync();

if (userExists) {
  throw new Error("User already exists");
}