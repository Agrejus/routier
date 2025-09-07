// Check if there are any unsaved changes
const hasChanges = await ctx.hasChangesAsync();
console.log("Has unsaved changes:", hasChanges);

// Preview what changes would be saved
const changes = await ctx.previewChangesAsync();
console.log("Pending changes:", changes);

// Check changes for specific collection
const userChanges = ctx.users.hasChanges();
console.log("Users collection has changes:", userChanges);