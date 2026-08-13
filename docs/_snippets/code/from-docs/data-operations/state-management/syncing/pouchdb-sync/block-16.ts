sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onChange: (schemas, change) => {
    if (change.change?.docs) {
      change.change.docs.forEach((doc) => {
        if (doc._conflicts && doc._conflicts.length > 0) {
          console.warn(`Conflict detected in document ${doc._id}`);
          // Handle conflict: merge, use local, use remote, etc.
        }
      });
    }
  }
}