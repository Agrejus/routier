sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onComplete: (schemas, event) => {
    console.log("Sync completed:", event);
  }
}