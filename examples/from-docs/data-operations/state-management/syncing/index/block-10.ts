// Monitor sync activity based on your plugin's API
onSyncStatus: (status) => {
  console.log("Sync status:", {
    state: status.state, // e.g., "syncing", "idle", "error"
    progress: status.progress, // e.g., percentage or count
    timestamp: new Date().toISOString(),
    details: status.details, // plugin-specific information
  });
};