const itemsToDelete = await ctx.items
  .where((i) => i.status === "archived")
  .toArrayAsync();
if (itemsToDelete.length > 0) {
  const confirmed = await confirmDeletion(itemsToDelete.length);
  if (confirmed) {
    await ctx.items.removeAsync(itemsToDelete);
    await ctx.saveChangesAsync();
  }
}