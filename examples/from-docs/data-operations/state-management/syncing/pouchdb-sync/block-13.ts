onChange: (schemas, change) => {
  // Monitor sync activity
  const syncInfo = {
    direction: change.direction,
    changeCount: change.change?.docs?.length || 0,
    timestamp: new Date().toISOString(),
    schemas: Array.from(schemas.keys()),
  };

  console.log("Sync status:", syncInfo);

  // Update UI with sync status
  updateSyncStatus(syncInfo);
};