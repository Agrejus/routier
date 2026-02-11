sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onPaused: (schemas, event) => {
    console.log("Sync paused - network may be unavailable");
  }
}