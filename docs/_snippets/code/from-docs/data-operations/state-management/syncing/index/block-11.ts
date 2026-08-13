sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: {
    live: true,
    filter: (doc) => doc.collectionName === "public_data"
  }
}