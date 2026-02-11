sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  filter: (doc) => {
    // Only sync documents from specific collections
    return doc.collectionName === "item" || doc.collectionName === "category";
  }
}