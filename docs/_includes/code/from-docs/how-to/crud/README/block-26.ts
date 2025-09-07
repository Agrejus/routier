// ✅ Good - save changes when logical units are complete
await ctx.users.addAsync(newUser);
await ctx.userProfiles.addAsync(newProfile);
await ctx.saveChangesAsync(); // Save both together

// ❌ Avoid - saving after every operation
await ctx.users.addAsync(newUser);
await ctx.saveChangesAsync();
await ctx.userProfiles.addAsync(newProfile);
await ctx.saveChangesAsync();

// ❌ Avoid - forgetting to save changes (changes will be lost)
await ctx.users.addAsync(newUser);
await ctx.userProfiles.addAsync(newProfile);
// Missing: await ctx.saveChangesAsync(); - Changes will NOT be persisted!