// Use filters to sync only necessary data (if your plugin supports it)
const syncConfig = {
  // Your plugin's connection configuration
  endpoint: "https://api.example.com/sync",

  // Filter data based on your plugin's API
  filter: (item) => {
    // Only sync items the current user has access to
    return item.userId === currentUserId;
  },

  // Batch operations if supported
  batchSize: 100,
  syncInterval: 5000,
};