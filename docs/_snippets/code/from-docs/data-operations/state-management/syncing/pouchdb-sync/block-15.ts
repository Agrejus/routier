sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onChange: (schemas, change) => {
    if (change.direction === "pull" && change.change?.docs) {
      console.log(`Pulled ${change.change.docs.length} documents`);
    } else if (change.direction === "push" && change.change?.docs) {
      console.log(`Pushed ${change.change.docs.length} documents`);
    }
  }
}