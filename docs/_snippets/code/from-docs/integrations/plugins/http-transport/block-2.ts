authorize: ({ action, collectionNames, context }) => {
  if (action !== "query") return "this endpoint is read-only";
  if (collectionNames.includes("audit")) return "audit is not readable";
  return context.userId != null;
}