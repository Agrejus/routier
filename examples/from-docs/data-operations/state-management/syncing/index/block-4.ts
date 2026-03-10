{
  (doc) => {
    // Only sync documents from specific collections
    return doc.collectionName === "item" || doc.collectionName === "category";
  };
}