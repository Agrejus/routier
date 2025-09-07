// Preview what will be saved
const changes = await ctx.previewChangesAsync();

console.log("Pending changes:");
console.log(`- ${changes.aggregate.adds} entities to add`);
console.log(`- ${changes.aggregate.updates} entities to update`);
console.log(`- ${changes.aggregate.removes} entities to remove`);

// Review changes before saving
if (changes.aggregate.total > 100) {
  console.warn("Large number of changes detected. Review before saving.");
  // Show confirmation dialog or review interface
} else {
  await ctx.saveChangesAsync();
}