// For very large datasets, consider batching
async function addLargeDataset(entities: any[], batchSize = 1000) {
  const ctx = new AppContext();

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    await ctx.users.addAsync(...batch);

    // Save every batch to avoid memory issues
    await ctx.saveChangesAsync();

    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}`);
  }
}

// Usage
const largeDataset = generateUsers(10000);
await addLargeDataset(largeDataset, 1000);