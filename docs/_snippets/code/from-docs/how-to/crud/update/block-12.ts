// Update fields conditionally
const usersToUpdate = await ctx.users
  .where((user) => user.status === "pending")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  // Only update if certain conditions are met
  if (user.email && user.email.includes("@")) {
    user.emailVerified = true;
    user.verificationDate = new Date();
  }

  if (user.phone && user.phone.length >= 10) {
    user.phoneVerified = true;
    user.phoneVerificationDate = new Date();
  }

  // Update status based on verification
  if (user.emailVerified && user.phoneVerified) {
    user.status = "verified";
    user.verifiedAt = new Date();
  }
});

console.log(`Conditionally updated ${usersToUpdate.length} users`);