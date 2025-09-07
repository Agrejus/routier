onChange: (schemas, change) => {
  // Handle sync events
  console.log("Sync direction:", change.direction);
  console.log("Change count:", change.change?.docs?.length || 0);
  console.log("Affected schemas:", Array.from(schemas.keys()));
};