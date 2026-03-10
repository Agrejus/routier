sync: {
  remoteDb: "http://localhost:5984/myapp",
  onChange: (schemas, change) => {
    if (change.change && change.change.docs) {
      change.change.docs.forEach((doc) => {
        if (doc._conflicts) {
          // Document has conflicts - handle them
          console.warn(`Conflict detected in document ${doc._id}`);
          // Implement your conflict resolution logic
        }
      });
    }
  }
}