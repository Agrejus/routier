sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onActive: (schemas) => {
    console.log("Sync resumed");
  }
}