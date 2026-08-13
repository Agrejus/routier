// ✅ Use without .subscribe() for static/one-time data
function ConfigDisplay() {
  const config = useQuery(
    (callback) => dataStore.config.toArray(callback), // No .subscribe()
    []
  );
  // Runs once, never updates - perfect for app configuration
}