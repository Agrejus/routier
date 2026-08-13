sync: {
  onChange: (schemas: SchemaCollection, change) => {
    if (change.direction === "pull" && change.change.docs) {
      // Group documents by collection
      const docsByCollection = change.change.docs.reduce(/* ... */);

      // Process each collection
      for (const collectionName in docsByCollection) {
        const schema = schemas.getByName(collectionName);
        const subscription = schema.createSubscription();

        subscription.send({
          adds: [],
          removals: [],
          updates: [],
          unknown: docsByCollection[collectionName],
        });

        subscription[Symbol.dispose]();
      }
    }
  };
}