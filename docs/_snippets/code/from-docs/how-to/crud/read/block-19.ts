// For large datasets, use pagination
async function processAllUsers(batchSize = 100) {
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await ctx.users
      .skip(processed)
      .take(batchSize)
      .toArrayAsync();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch
    for (const user of batch) {
      // Process user
      console.log(`Processing user: ${user.name}`);
    }

    processed += batch.length;
    console.log(`Processed ${processed} users`);
  }
}

// Usage
await processAllUsers(100);