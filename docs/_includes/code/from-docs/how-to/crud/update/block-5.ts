// Update nested object properties
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Update nested address
  user.address.street = "789 Pine Street";
  user.address.city = "Metropolis";
  user.address.state = "NY";
  user.address.zipCode = "10001";

  // Update nested profile
  user.profile.bio = "Updated bio information";
  user.profile.website = "https://johnsmith.com";
  user.profile.socialMedia = {
    twitter: "@johnsmith",
    linkedin: "john-smith-123",
  };

  // All nested changes are tracked
  console.log("Nested objects updated");
}