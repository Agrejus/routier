export function compiledSchemaToSqliteTable(
  schema: CompiledSchema<any>
): string {
  const columns: string[] = [];
  const idProps = schema.idProperties;
  const identityProps = idProps.filter((p) => p.isIdentity);

  // Handle single identity PK
  let singleIdentityPK: PropertyInfo<any> | undefined;
  if (identityProps.length === 1 && idProps.length === 1) {
    singleIdentityPK = identityProps[0];
  }

  // Build column definitions
  for (const prop of schema.properties) {
    let colDef: string;

    if (singleIdentityPK && prop.name === singleIdentityPK.name) {
      // Handle identity primary key
      if (prop.type === SchemaTypes.Number) {
        colDef = `"${prop.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
      } else if (prop.type === SchemaTypes.String) {
        colDef = `"${prop.name}" TEXT PRIMARY KEY DEFAULT (uuid_function())`;
      }
    } else if (isDeeplyNested(prop)) {
      colDef = `"${prop.name}" JSON`;
    } else {
      colDef = `"${prop.name}" ${schemaTypeToSqliteType(prop.type)}`;
    }

    columns.push(colDef);
  }

  // Handle composite primary keys
  let pkClause = "";
  if (!singleIdentityPK && idProps.length > 0) {
    const pkCols = idProps.map((p) => `"${p.name}"`);
    pkClause = `, PRIMARY KEY (${pkCols.join(", ")})`;
  }

  // Build CREATE TABLE statement
  return `CREATE TABLE IF NOT EXISTS "${schema.collectionName}" (
  ${columns.join(",\n  ")}${pkClause}
);`;
}