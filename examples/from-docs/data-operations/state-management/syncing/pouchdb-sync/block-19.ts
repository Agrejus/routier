onChange: (schemas, change) => {
  if (change.error) {
    // Log error for debugging
    console.error("Sync error:", change.error);

    // Implement retry logic
    if (change.error.name === "network_error") {
      setTimeout(() => {
        console.log("Retrying sync...");
        // Sync will automatically retry
      }, 5000);
    }
  }
};