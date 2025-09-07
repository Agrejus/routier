onChange: (schemas, change) => {
  if (change.change && change.change.docs) {
    change.change.docs.forEach((doc) => {
      if (doc._conflicts) {
        console.log("Conflict detected for document:", doc.id);
        console.log("Conflicts:", doc._conflicts);

        // Implement your conflict resolution strategy
        resolveConflict(doc);
      }
    });
  }
};

async function resolveConflict(doc) {
  // Strategy 1: Use the most recent version
  const resolved = await getMostRecentVersion(doc);

  // Strategy 2: Merge changes manually
  const merged = await mergeConflictingChanges(doc);

  // Strategy 3: Prompt user to choose
  const userChoice = await promptUserForResolution(doc);
}