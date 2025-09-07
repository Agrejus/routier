// ✅ Good - update related fields together
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
if (user) {
  user.firstName = "John";
  user.lastName = "Smith";
  user.fullName = "John Smith"; // Related field
  user.nameUpdatedAt = new Date(); // Metadata
}

// ❌ Avoid - scattered updates
// user.firstName = "John";
// // ... later ...
// user.lastName = "Smith";
// // ... later ...
// user.fullName = "John Smith";