// Example conflict handling approaches
onConflict: (conflict) => {
  // Handle conflicts based on your plugin's implementation
  console.log("Conflict detected:", conflict);

  // Common strategies:
  // - Use the most recent version
  // - Merge changes manually
  // - Prompt the user to choose
  // - Apply business rules
};

// Or your plugin might use different event names
onDataConflict: (conflict) => {
  /* ... */
};
onSyncConflict: (conflict) => {
  /* ... */
};