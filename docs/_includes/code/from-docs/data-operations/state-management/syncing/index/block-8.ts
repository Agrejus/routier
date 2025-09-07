// Handle sync errors based on your plugin's implementation
onSyncError: (error) => {
  console.error("Sync error:", error);

  // Handle specific error types based on your plugin
  if (error.type === "unauthorized") {
    // Re-authenticate user
  } else if (error.type === "conflict") {
    // Handle conflicts
  } else if (error.code === "NETWORK_ERROR") {
    // Handle network issues
  }
};