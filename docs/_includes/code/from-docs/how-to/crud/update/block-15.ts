// Save changes for specific operations
async function updateUserProfile(userId: string, profileData: any) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Update profile
  Object.assign(user.profile, profileData);
  user.profileUpdatedAt = new Date();

  // Save only these changes
  await ctx.saveChangesAsync();

  console.log("User profile updated and saved");
  return user;
}