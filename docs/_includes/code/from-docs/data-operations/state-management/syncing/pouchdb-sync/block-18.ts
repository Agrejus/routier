// Check connectivity before enabling live sync
if (navigator.onLine) {
  console.log("Online - enabling live sync");
} else {
  console.log("Offline - sync will resume when online");
}

// Listen for connectivity changes
window.addEventListener("online", () => {
  console.log("Connection restored - resuming sync");
});

window.addEventListener("offline", () => {
  console.log("Connection lost - sync paused");
});