for (const [schemaId, changes] of event.operation) {
  // schemaId is the schema identifier
  // changes contains adds, updates, removes for this schema

  const schema = event.schemas.get(schemaId);
  const { adds, updates, removes, hasItems } = changes;

  // hasItems tells you if there are any changes to process
  if (!hasItems) continue;

  // Process adds, updates, removes as needed
  // Note: removes are typically executed first when updating
  // the same collection (to avoid constraint violations)
}