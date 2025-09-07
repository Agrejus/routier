// Check what deletions are pending
const changes = await ctx.previewChangesAsync();
console.log("Pending changes:", changes);

if (changes.aggregate.removes > 0) {
  console.log(`${changes.aggregate.removes} entities marked for removal`);
}