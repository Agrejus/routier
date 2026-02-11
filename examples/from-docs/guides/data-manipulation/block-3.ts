const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Update nested address
  user.address.street = "789 Pine Street";
  user.address.city = "Metropolis";
  user.address.zipCode = "10001";

  // Update nested profile
  user.profile.bio = "Updated bio";
  user.profile.website = "https://johnsmith.com";

  // All nested changes are tracked
  await ctx.saveChangesAsync();
}