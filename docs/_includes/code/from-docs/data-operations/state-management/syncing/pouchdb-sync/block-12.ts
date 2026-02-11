sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onDenied: (schemas, event) => {
    console.error("Sync denied:", event);
  }
}