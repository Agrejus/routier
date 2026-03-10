sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: {
    live: true,     // Continuous sync
    retry: true,    // Auto-retry
    filter: (doc) => {
      // Only sync specific documents
      return doc.collectionName === "season";
    }
  },
  push: false       // Disable pushing (pull-only)
}