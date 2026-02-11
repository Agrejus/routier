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