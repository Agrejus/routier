onChange: (schemas, change) => {
  if (change.change && change.change.docs) {
    change.change.docs.forEach((doc) => {
      // Validate synced documents
      if (!isValidDocument(doc)) {
        console.warn("Invalid document synced:", doc);
        // Handle invalid data
      }
    });
  }
};