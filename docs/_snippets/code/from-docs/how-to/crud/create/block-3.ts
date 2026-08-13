const batchSize = 100;
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await ctx.items.addAsync(...batch);
  await ctx.saveChangesAsync();
}