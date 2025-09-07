// Example: Changes are tracked but NOT persisted
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "123");
user.name = "New Name"; // Change tracked in memory

// Change is tracked but NOT in database yet
const hasChanges = await ctx.hasChangesAsync(); // true

// Must call saveChanges to persist to database
await ctx.saveChangesAsync(); // Now change is persisted