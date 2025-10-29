---
title: Query Translation & Table Creation
layout: default
parent: Advanced Plugins
grand_parent: Integrations
nav_order: 1
---

## Query Translation & Table Creation

When creating a plugin that uses SQL or other query languages, you'll need to translate Routier queries into your backend's query format and handle schema-to-table creation.

## Overview

SQL-based plugins (like SQLite) perform two main translations:

1. **Table Creation**: Convert Routier schemas into SQL CREATE TABLE statements with proper types, keys, indexes, and constraints
2. **Query Translation**: Convert Routier query operations (filters, sorts, pagination, aggregations) into SQL SELECT statements

## Table Creation

The `compiledSchemaToSqliteTable` function demonstrates how to convert a CompiledSchema into SQL DDL statements. Here's what it handles:

### Schema Type Mapping

```ts
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
```

### Key Considerations

- **Primary Keys**: Handle single identity PKs vs composite PKs

  - Single numeric identity: `INTEGER PRIMARY KEY AUTOINCREMENT`
  - Single string identity: `TEXT PRIMARY KEY DEFAULT (uuid_function())`
  - Composite PKs: `PRIMARY KEY (col1, col2)`

- **Indexes**: Create indexes for:

  - `.distinct()` properties → `UNIQUE INDEX`
  - `.index()` properties → `CREATE INDEX` (single or composite)
  - Multiple properties with the same index name → composite index

- **Nested Data**: Objects and arrays are stored as JSON columns

### Example Table Creation

```ts
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
```

## Expression Translation

The `expressionToWhereClause` function translates Routier Expression trees into SQL WHERE clauses with parameterized queries.

### Expression Types

Routier uses an Expression tree structure:

- **OperatorExpression**: Logical operators (`&&`, `||`)
- **ComparatorExpression**: Comparisons (`equals`, `greater-than`, `starts-with`, etc.)
- **PropertyExpression**: References to schema properties
- **ValueExpression**: Literal values

### Translation Pattern

```ts
export function expressionToWhereClause(expr: Expression): {
  where: string;
  params: any[];
} {
  const params: any[] = [];

  function walk(e: Expression): string {
    if (e.type === "operator") {
      const op = (e as OperatorExpression).operator;
      const left = walk(e.left);
      const right = walk(e.right);
      const sqlOp = op === "&&" ? "AND" : op === "||" ? "OR" : op;
      return `(${left} ${sqlOp} ${right})`;
    }

    if (e.type === "comparator") {
      const cmp = e as ComparatorExpression;
      const leftExpr = walk(cmp.left);
      const rightExpr = walk(cmp.right);

      // Translate comparator to SQL operator
      switch (cmp.comparator) {
        case "equals":
          return `${leftExpr} = ${rightExpr}`;
        case "greater-than":
          return `${leftExpr} > ${rightExpr}`;
        // ... etc
      }
    }

    if (e.type === "property") {
      return `"${(e as PropertyExpression).property.name}"`;
    }

    if (e.type === "value") {
      params.push((e as ValueExpression).value);
      return "?"; // Parameter placeholder
    }

    throw new Error(`Unknown expression type: ${(e as any).type}`);
  }

  const where = walk(expr);
  return { where, params };
}
```

### Special Cases

- **String Operations**: `starts-with`, `ends-with`, `includes` need special handling:

  - `starts-with`: Use `LIKE 'value%'` or `GLOB 'value*'`
  - `includes`: Array values use `IN (...)`, strings use `LIKE '%value%'`

- **Null Comparisons**: `equals null` becomes `IS NULL`

- **Array Includes**: Detect array values and use `IN` operator

## Query Building

The `buildFromQueryOperation` function constructs complete SQL queries from Routier's IQuery object:

### Operation Processing Order

1. **Column Selection**: Determine which columns to select (from `map` operations or all properties)
2. **Filters**: Build WHERE clause from filter expressions
3. **Sorting**: Add ORDER BY clauses
4. **Pagination**: Handle `skip` and `take` with LIMIT/OFFSET
5. **Aggregations**: Replace SELECT with COUNT, MIN, MAX, SUM
6. **Distinct**: Add DISTINCT keyword

### Key Pattern

```ts
export function buildFromQueryOperation<TEntity, TShape>(
  query: IQuery<TEntity, TShape>
): SqlOperation {
  const { schema, options } = query;
  let currentQuery = `SELECT ${columnsStr} FROM "${schema.collectionName}"`;
  const params: any[] = [];

  // Collect and categorize operations
  const filterOps = [];
  const sortOps = [];
  const skipTakeOps = [];

  // Process filters
  for (const op of filterOps) {
    const { where, params: filterParams } = expressionToWhereClause(
      op.value.expression
    );
    params.push(...filterParams);
    currentQuery += ` WHERE ${where}`;
  }

  // Process sorts
  for (const op of sortOps) {
    currentQuery += ` ORDER BY "${op.value.propertyName}" ${op.value.direction}`;
  }

  // Process pagination
  if (skipValue !== null || takeValue !== null) {
    if (skipValue !== null && takeValue !== null) {
      currentQuery += ` LIMIT ${takeValue} OFFSET ${skipValue}`;
    }
  }

  // Process aggregations
  if (hasCount) {
    currentQuery = currentQuery.replace(
      /SELECT .*? FROM/,
      'SELECT COUNT(*) AS "count" FROM'
    );
  }

  return { sql: currentQuery, params };
}
```

## Common Gotchas

### Parameter Binding

Always use parameterized queries to prevent SQL injection:

- Use `?` placeholders in SQL
- Push values to a `params` array in order
- Pass both SQL and params to your database driver

### Table Creation Timing

- **Lazy Creation**: Create tables on first use (catch `no such table` errors)
- **Eager Creation**: Create all tables during plugin initialization
- **Cache**: Cache CREATE TABLE statements to avoid regeneration

### Type Serialization

Handle type conversions:

- Dates: Store as ISO strings, deserialize on read
- JSON: Serialize objects/arrays to JSON strings
- Booleans: Convert to integers if your SQL doesn't support boolean type

### Index Creation

- Create indexes **after** table creation
- Handle composite indexes when multiple properties share an index name
- Use `IF NOT EXISTS` to avoid errors on repeated creation

## Reference Implementation

See the [SQLite plugin utils](https://github.com/agrejus/routier/blob/main/plugins/sqlite/src/utils.ts) for a complete implementation of:

- `compiledSchemaToSqliteTable` - Schema to table conversion
- `expressionToWhereClause` - Expression tree to SQL WHERE translation
- `buildFromQueryOperation` - Complete query building
- `buildFromPersistOperation` - INSERT/UPDATE/DELETE statement building
