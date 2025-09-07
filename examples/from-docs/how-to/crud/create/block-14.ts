// For large datasets, consider batching
async function createLargeDataset(entities: any[], batchSize = 1000) {
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    await ctx.users.addAsync(...batch);

    // Save every batch to avoid memory issues
    await ctx.saveChangesAsync();

    console.log(`Created batch ${Math.floor(i / batchSize) + 1}`);
  }
}

// Usage
const largeDataset = generateUsers(10000);
await createLargeDataset(largeDataset, 1000);