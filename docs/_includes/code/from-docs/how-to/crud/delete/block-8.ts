// Remove users with confirmation
async function removeUsersWithConfirmation(criteria: any) {
  const usersToRemove = await ctx.users
    .where((user) => user.status === criteria.status)
    .toArrayAsync();

  if (usersToRemove.length === 0) {
    console.log("No users found matching criteria");
    return;
  }

  console.log(`Found ${usersToRemove.length} users to remove`);
  console.log(
    "Users:",
    usersToRemove.map((u) => u.name)
  );

  // Confirm removal
  const confirmed = confirm(`Remove ${usersToRemove.length} users?`);

  if (confirmed) {
    await ctx.users.removeAsync(...usersToRemove);
    console.log("Users removed successfully");
  } else {
    console.log("Removal cancelled");
  }
}

// Usage
await removeUsersWithConfirmation({ status: "suspended" });