// ✅ Good - save after logical units
await ctx.users.addAsync(...newUsers);
await ctx.userProfiles.addAsync(...newProfiles);
await ctx.saveChangesAsync(); // Save related operations together

// ❌ Avoid - saving after every operation
for (const user of users) {
  await ctx.users.addAsync(user);
  await ctx.saveChangesAsync(); // Inefficient
}