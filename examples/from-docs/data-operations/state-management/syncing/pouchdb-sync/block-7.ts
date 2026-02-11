sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onChange: (schemas, change) => {
    if (change.direction === "pull" && change.change?.docs) {
      // Process pulled documents
      console.log(`Pulled ${change.change.docs.length} documents`);
    }
  }
}