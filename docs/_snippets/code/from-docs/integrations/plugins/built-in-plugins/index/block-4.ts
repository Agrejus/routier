const result = event.operation.toResult();

// After persisting adds
const { adds } = result.get(schemaId);
adds.push(...persistedEntities);

// Similar for updates and removes