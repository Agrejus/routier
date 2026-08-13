const schemaTypeToSqliteType = (type: SchemaTypes): string => {
  switch (type) {
    case SchemaTypes.String:
      return "TEXT";
    case SchemaTypes.Number:
      return "REAL";
    case SchemaTypes.Boolean:
      return "INTEGER"; // SQLite uses INTEGER for booleans
    case SchemaTypes.Date:
      return "TEXT"; // Stored as ISO string
    case SchemaTypes.Object:
    case SchemaTypes.Array:
      return "JSON"; // Deeply nested structures
    default:
      return "TEXT";
  }
};