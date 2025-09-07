// Group related changes together
async function processUserRegistration(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) return;

  // Group all registration-related updates
  user.status = "active";
  user.registeredAt = new Date();
  user.verificationStatus = "verified";
  user.welcomeEmailSent = true;
  user.lastActivity = new Date();

  // Save all changes together
  await ctx.saveChangesAsync();

  console.log("User registration completed");
}