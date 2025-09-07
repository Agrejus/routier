onSyncStart: () => console.log("Sync started");
onSyncComplete: (result) => console.log("Sync complete", result);
onSyncError: (error) => console.log("Sync error", error);
onDataChange: (changes) => console.log("Data changed", changes);