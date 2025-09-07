// Enable debug logging based on your plugin's API
const plugin = new MyPlugin("myapp", {
  // Your plugin's sync configuration
  sync: {
    endpoint: "https://api.example.com/sync",
    debug: true, // Enable debug mode if supported
    verbose: true, // Enable verbose logging if supported
    logLevel: "debug", // Set log level if supported
  },

  // Event handlers for debugging
  onSyncEvent: (event) => {
    console.group("Sync Event");
    console.log("Type:", event.type);
    console.log("Data:", event.data);
    console.log("Timestamp:", new Date().toISOString());
    console.groupEnd();
  },
});