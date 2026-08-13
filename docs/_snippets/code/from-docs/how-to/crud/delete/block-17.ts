// For very large datasets, consider batching
async function removeLargeDataset(criteria: any, batchSize = 1000) {
  let totalRemoved = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await ctx.users
      .where((user) => user.status === criteria.status)
      .take(batchSize)
      .toArrayAsync();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    await ctx.users.removeAsync(...batch);
    await ctx.saveChangesAsync();

    totalRemoved += batch.length;
    console.log(
      `Removed batch: ${batch.length} users (Total: ${totalRemoved})`
    );
  }

  console.log(`Total users removed: ${totalRemoved}`);
}

// Usage
await removeLargeDataset({ status: "inactive" }, 1000);