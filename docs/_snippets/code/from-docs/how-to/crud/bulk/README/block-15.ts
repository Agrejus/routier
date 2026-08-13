async function bulkOperationWithPartialSuccess() {
  const ctx = new AppContext();

  try {
    // Try to add users in smaller batches
    const allUsers = generateUsers(1000);
    const batchSize = 100;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < allUsers.length; i += batchSize) {
      try {
        const batch = allUsers.slice(i, i + batchSize);
        await ctx.users.addAsync(...batch);
        await ctx.saveChangesAsync();
        successCount += batch.length;
      } catch (batchError) {
        failureCount += batch.length;
        console.error(
          `Batch ${Math.floor(i / batchSize) + 1} failed:`,
          batchError
        );
        // Continue with next batch
      }
    }

    console.log(
      `Bulk operation completed: ${successCount} successful, ${failureCount} failed`
    );
  } catch (error) {
    console.error("Bulk operation failed completely:", error);
  }
}