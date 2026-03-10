sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onError: (schemas, error) => {
    console.error("Sync error:", error);
    // Handle error, notify user, etc.
  }
}