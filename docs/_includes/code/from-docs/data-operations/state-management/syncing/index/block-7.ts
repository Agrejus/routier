// Check connectivity before enabling sync
if (navigator.onLine) {
  // Enable sync based on your plugin's API
  plugin.startSync();
} else {
  // Disable sync based on your plugin's API
  plugin.stopSync();
}

// Listen for connectivity changes
window.addEventListener("online", () => plugin.startSync());
window.addEventListener("offline", () => plugin.stopSync());