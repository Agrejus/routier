import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression } from '@routier/core/expressions';
import { buildGroupedUpdateOperations, getDialect, sqlColumnProperties, toColumnValueMap, toSql } from '@routier/sql-plugin-core';
import { IQuery, QueryField } from '@routier/core/plugins';
import { SchemaPersistChanges } from '@routier/core/collections';
import { SqlOperation } from './types';

/**
 * Maps schema types to SQLite column types.
 */
const schemaTypeToSqliteType = (type: SchemaTypes): string => {
    switch (type) {
        case SchemaTypes.String:
            return 'TEXT';
        case SchemaTypes.Number:
            return 'REAL';
        case SchemaTypes.Boolean:
            return 'INTEGER'; // SQLite does not have a separate boolean type
        case SchemaTypes.Date:
            return 'TEXT'; // ISO string
        case SchemaTypes.Object:
        case SchemaTypes.Array:
            // One source of truth for this engine's JSON type: the same dialect value
            // toColumnAssignments encodes against, so DDL and DML cannot drift apart.
            return getDialect('sqlite').jsonColumnType;
        default:
            return 'TEXT';
    }
};

/**
 * Determines if a property is deeply nested (object or array).
 */
const isDeeplyNested = (prop: PropertyInfo<any>): boolean => {
    return prop.type === SchemaTypes.Object || prop.type === SchemaTypes.Array;
};

/**
 * Converts a CompiledSchema to a SQLite CREATE TABLE statement and index statements.
 *
 * - Flat properties are mapped to SQLite types.
 * - Deeply nested properties (objects/arrays) are stored as JSON.
 * - If a single identity PK is a number, uses AUTOINCREMENT.
 * - If a single identity PK is a string, uses a UUID default.
 * - Composite PKs use a regular PRIMARY KEY clause.
 * - Adds UNIQUE indexes for isDistinct properties.
 * - Adds single or composite indexes for properties sharing the same index name.
 *
 * @param schema The compiled schema to convert.
 * @param tableName Optional table name (defaults to schema.collectionName).
 * @returns The CREATE TABLE SQL statement and CREATE INDEX statements as a single string.
 */
export function compiledSchemaToSqliteTable(schema: CompiledSchema<any>, tableName?: string): string {
    const columns: string[] = [];
    const idProps = schema.idProperties;
    const identityProps = idProps.filter(p => p.isIdentity);
    const table = tableName || schema.collectionName;

    // Single identity PK logic
    let singleIdentityPK: PropertyInfo<any> | undefined;
    if (identityProps.length === 1 && idProps.length === 1) {
        singleIdentityPK = identityProps[0];
    }

    // Root properties only: a nested subtree is ONE JSON column named for its root.
    // Iterating every property would emit a column per descendant, named by its leaf.
    for (const prop of sqlColumnProperties(schema)) {
        let colDef: string;

        if (singleIdentityPK && prop.name === singleIdentityPK.name) {
            if (prop.type === SchemaTypes.Number) {
                colDef = `"${prop.getResolvedName()}" INTEGER PRIMARY KEY AUTOINCREMENT`;
            } else if (prop.type === SchemaTypes.String) {
                colDef = `"${prop.getResolvedName()}" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))))`;
            } else {
                colDef = `"${prop.getResolvedName()}" ${schemaTypeToSqliteType(prop.type)} PRIMARY KEY`;
            }
        } else if (isDeeplyNested(prop)) {
            colDef = `"${prop.getResolvedName()}" JSON`;
        } else {
            colDef = `"${prop.getResolvedName()}" ${schemaTypeToSqliteType(prop.type)}`;
        }

        columns.push(colDef);
    }

    // Composite PK logic
    let pkClause = '';
    if ((!singleIdentityPK) && idProps.length > 0) {
        const pkCols = idProps.map(p => `"${p.getResolvedName()}"`);
        pkClause = `, PRIMARY KEY (${pkCols.join(', ')})`;
    }

    // Indexes
    const indexStatements: string[] = [];
    const indexMap: Record<string, PropertyInfo<any>[]> = {};
    const usedIndexNames = new Set<string>();

    // 1. Unique indexes for isDistinct
    for (const prop of schema.properties) {
        if (prop.isDistinct) {
            const idxName = `${table}_${prop.name}_unique_idx`;
            if (!usedIndexNames.has(idxName)) {
                indexStatements.push(`CREATE UNIQUE INDEX IF NOT EXISTS "${idxName}" ON "${table}" ("${prop.getResolvedName()}");`);
                usedIndexNames.add(idxName);
            }
        }
    }

    // 2. Collect all index names and their properties
    for (const prop of schema.properties) {
        for (const idx of prop.indexes) {
            if (!indexMap[idx]) indexMap[idx] = [];
            indexMap[idx].push(prop);
        }
    }

    // 3. Create indexes (single or composite)
    for (const idxName in indexMap) {
        const props = indexMap[idxName];
        if (props.length === 1) {
            // Single-column index
            const idxSqlName = `${table}_${props[0].name}_idx`;
            if (!usedIndexNames.has(idxSqlName)) {
                indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" ("${props[0].getResolvedName()}");`);
                usedIndexNames.add(idxSqlName);
            }
        } else if (props.length > 1) {
            // Composite (clustered) index
            const idxSqlName = `${table}_${idxName}_clustered_idx`;
            const colList = props.map(p => `"${p.getResolvedName()}"`).join(', ');
            if (!usedIndexNames.has(idxSqlName)) {
                indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" (${colList});`);
                usedIndexNames.add(idxSqlName);
            }
        }
    }

    const sql = `CREATE TABLE IF NOT EXISTS "${table}" (
  ${columns.join(',\n  ')}${pkClause}
);
${indexStatements.join('\n')}`;
    return sql;
}

/**
 * Translates an Expression tree to a SQLite WHERE clause and parameters.
 * @deprecated Use `toSql(expr, 'sqlite')` from `@routier/core/expressions` for dialect-agnostic SQL.
 */
export function expressionToWhereClause(expr: Expression): { where: string; params: unknown[] } {
    return toSql(expr, 'sqlite');
}

/**
 * Builds a SELECT statement from a table, an Expression, and optional columns.
 *
 * @param table The table name.
 * @param expression The Expression for the WHERE clause.
 * @param columns The columns to select (default '*').
 * @returns The SQL SELECT statement and parameters.
 */
export function buildSelectFromExpression<TEntity extends {}, TShape>(options: {
    query: IQuery<TEntity, TShape>,
    schema: CompiledSchema<TEntity>
}): { sql: string, params: any[] } {
    const { schema, query } = options;
    const columns = schema.properties && schema.properties.length > 0
        ? schema.properties.map(p => `"${p.getResolvedName()}"`)
        : ['*'];

    // Get the first filter expression from the query options
    const filterOptions = query.options.get('filter');
    if (!filterOptions || filterOptions.length === 0) {
        const sql = `SELECT ${columns.join(', ')} FROM "${schema.collectionName}"`;
        return { sql, params: [] };
    }

    const firstFilter = filterOptions[0].option.value;
    const { where, params } = expressionToWhereClause(firstFilter.expression);
    const sql = `SELECT ${columns.join(', ')} FROM "${schema.collectionName}" WHERE ${where}`;
    return { sql, params };
}

export function buildFromPersistOperation<TEntity extends {}>(schema: CompiledSchema<TEntity>, changes: SchemaPersistChanges<Record<string, unknown>>): {
    adds: SqlOperation | null;
    updates: SqlOperation[];
    removes: SqlOperation | null;
} {
    const collectionName = schema.collectionName;
    const {
        adds,
        hasItems,
        removes,
        updates
    } = changes;

    if (!hasItems) {
        return { adds: null, updates: [], removes: null };
    }

    // Column identifiers are storage-side names (PropertyInfo.from ?? name): the entities
    // handed to bulkPersist are wire-shaped, so both the DDL and the DML must use them
    const columnProperties = sqlColumnProperties(schema);
    const allColumns = columnProperties.map(p => `"${p.getResolvedName()}"`);
    const allColumnStr = allColumns.join(', ');

    // For INSERT operations, exclude identity columns (they're auto-generated)
    const insertProperties = columnProperties.filter(p => !p.isIdentity);
    const insertColumns = insertProperties.map(p => `"${p.getResolvedName()}"`);
    const insertColumnStr = insertColumns.join(', ');

    // Handle INSERT operations (adds)
    let addsOperation: SqlOperation | null = null;
    if (adds.length > 0) {
        const placeholders = adds.map(() =>
            `(${insertColumns.map(() => '?').join(', ')})`
        ).join(', ');

        const insertSql = `INSERT INTO "${collectionName}" (${insertColumnStr}) VALUES ${placeholders} RETURNING ${allColumnStr}`;

        // Flatten all add parameters (excluding identity columns)
        const addParams: any[] = [];
        for (const add of adds) {
            // Routed through the same column resolution the UPDATE path uses, so a nested
            // object is JSON-encoded here too rather than handed to the driver as an object.
            const values = toColumnValueMap(add as Record<string, unknown>, schema, getDialect('sqlite'));

            for (const col of insertProperties) {
                addParams.push(values.get(col.getResolvedName()));
            }
        }

        addsOperation = { sql: insertSql, params: addParams };
    }

    // Handle UPDATE operations (updates). One SqlOperation per changed-column group — the
    // shared builder resolves deltas to columns (renames, JSON encoding, empty-delta
    // fallback) and never joins groups with ';' (defect #22).
    const updatesOperations: SqlOperation[] = buildGroupedUpdateOperations(
        schema,
        updates as { entity: Record<string, unknown>; delta: Record<string, unknown> }[],
        getDialect('sqlite'),
        { suffix: ` RETURNING ${allColumnStr}` }
    ).map(({ sql, params }) => ({ sql, params }));

    // Handle DELETE operations (removes)
    let removesOperation: SqlOperation | null = null;
    if (removes.length > 0) {
        const idProperties = schema.idProperties;

        // Build WHERE clause for each remove operation
        const whereClauses: string[] = [];
        const allParams: any[] = [];

        for (const remove of removes) {
            const entityWhereClauses: string[] = [];

            for (const idProperty of idProperties) {
                const idValue = idProperty.getValue(remove);
                entityWhereClauses.push(`"${idProperty.getResolvedName()}" = ?`);
                allParams.push(idValue);

            }

            whereClauses.push(`(${entityWhereClauses.join(' AND ')})`);
        }

        const whereClause = whereClauses.join(' OR ');
        const deleteSql = `DELETE FROM "${collectionName}" WHERE ${whereClause} RETURNING ${allColumnStr}`;
        removesOperation = { sql: deleteSql, params: allParams };
    }

    return {
        adds: addsOperation,
        updates: updatesOperations,
        removes: removesOperation
    };
}

/**
 * Builds a complete SQL query from an IQuery object, handling ordered operations
 * like filters, sorts, skip, take, etc. Creates nested subqueries when needed.
 *
 * @param query The IQuery object containing options and schema
 * @returns The complete SQL statement and parameters
 */
export function buildFromQueryOperation<TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>): SqlOperation {
    const { schema, options } = query;
    const tableName = schema.collectionName;

    // Check if there's a map operation that specifies which columns to select
    let mapFields: QueryField[] | null = null;
    for (const [, items] of options.items) {
        for (const item of items) {
            if (item.option.name === 'map' && item.option.value.fields) {
                mapFields = item.option.value.fields;
                break;
            }
        }
        if (mapFields) break;
    }

    // Build column string based on map fields or all properties
    let columnsStr: string;
    if (mapFields && mapFields.length > 0) {
        // Remapping will happen in the translator after this
        columnsStr = `"${mapFields[0].sourceName}"`;
        for (let i = 1; i < mapFields.length; i++) {
            const fieldName = mapFields[i].sourceName;
            columnsStr += `, "${fieldName}"`;
        }
    } else {
        // Use all schema properties
        const columnCount = schema.properties.length;
        if (columnCount === 0) {
            throw new Error("Need to select at least one column, found zero");
        }

        // Use string concatenation instead of array join for better performance
        columnsStr = `"${schema.properties[0].getResolvedName()}"`;
        for (let i = 1; i < columnCount; i++) {
            columnsStr += `, "${schema.properties[i].getResolvedName()}"`;
        }
    }

    const params: any[] = [];
    let currentQuery = `SELECT ${columnsStr} FROM "${tableName}"`;

    // Pre-allocate operations array with known size for better performance
    const operations: Array<{ type: string, value: any, index: number }> = [];

    // Count total operations first to avoid array resizing
    let totalOps = 0;
    for (const [, items] of options.items) {
        totalOps += items.length;
    }
    operations.length = totalOps;

    // Collect all operations in order - single pass
    let opIndex = 0;
    for (const [, items] of options.items) {
        for (const item of items) {
            operations[opIndex++] = {
                type: item.option.name,
                value: item.option.value,
                index: item.index
            };
        }
    }

    // Sort operations by index to maintain order
    operations.sort((a, b) => a.index - b.index);

    // Single pass to categorize operations - avoid multiple filter() calls
    const filterOps: typeof operations = [];
    const sortOps: typeof operations = [];
    const skipTakeOps: typeof operations = [];
    const otherOps: typeof operations = [];

    for (const op of operations) {
        switch (op.type) {
            case 'filter':
                filterOps.push(op);
                break;
            case 'sort':
                sortOps.push(op);
                break;
            case 'skip':
            case 'take':
                skipTakeOps.push(op);
                break;
            default:
                otherOps.push(op);
                break;
        }
    }

    // Phase 1: Build base query with filters and sorts
    let hasWhereClause = false;
    for (const op of filterOps) {
        const filterExpr = op.value.expression;
        if (filterExpr) {
            const { where, params: filterParams } = expressionToWhereClause(filterExpr);
            params.push(...filterParams);

            if (!hasWhereClause) {
                currentQuery += ` WHERE ${where}`;
                hasWhereClause = true;
            } else {
                currentQuery += ` AND ${where}`;
            }
        }
    }

    for (const op of sortOps) {
        const sortProp = op.value.propertyName;
        const sortDir = op.value.direction === 'asc' ? 'ASC' : 'DESC';
        currentQuery += ` ORDER BY "${sortProp}" ${sortDir}`;
    }

    // Phase 2: Handle skip/take operations (create subqueries)
    let subqueryCount = 0;
    let skipValue: number | null = null;
    let takeValue: number | null = null;

    // Collect skip and take values
    for (const op of skipTakeOps) {
        if (op.type === 'skip') {
            skipValue = op.value;
        } else if (op.type === 'take') {
            takeValue = op.value;
        }
    }

    // Apply skip/take with proper SQLite syntax
    if (skipValue !== null || takeValue !== null) {
        if (skipValue !== null && takeValue !== null) {
            // Both skip and take: LIMIT take OFFSET skip
            subqueryCount++;
            currentQuery = `SELECT ${columnsStr} FROM (${currentQuery}) AS subquery_${subqueryCount} LIMIT ${takeValue} OFFSET ${skipValue}`;
        } else if (skipValue !== null) {
            // Only skip: Use a large LIMIT with OFFSET (SQLite requires LIMIT before OFFSET)
            subqueryCount++;
            currentQuery = `SELECT ${columnsStr} FROM (${currentQuery}) AS subquery_${subqueryCount} LIMIT -1 OFFSET ${skipValue}`;
        } else if (takeValue !== null) {
            // Only take: LIMIT take
            currentQuery += ` LIMIT ${takeValue}`;
        }
    }

    // Phase 3: Handle other operations
    for (const op of otherOps) {
        switch (op.type) {

            case 'distinct':
                // Add DISTINCT to the SELECT clause
                if (currentQuery.includes('SELECT * FROM')) {
                    currentQuery = currentQuery.replace('SELECT *', 'SELECT DISTINCT *');
                } else if (currentQuery.includes('SELECT ')) {
                    currentQuery = currentQuery.replace('SELECT ', 'SELECT DISTINCT ');
                }
                break;

            case 'count':
                // Wrap rather than rewrite the SELECT: a rewritten query keeps its
                // LIMIT/OFFSET, which then applies to the single count row (OFFSET
                // skips it entirely). Wrapping counts whatever the built query yields
                currentQuery = `SELECT COUNT(*) AS "count" FROM (${currentQuery}) AS count_subquery`;
                break;

            case 'min':
            case 'max':
            case 'sum':
                // Handle aggregate functions - replace the SELECT clause with the aggregate
                // Pre-compute aggregate field to avoid repeated lookups
                let aggregateField = 'id'; // Default fallback
                for (const otherOp of otherOps) {
                    if (otherOp.type === 'map' && otherOp.value.fields && otherOp.value.fields.length > 0) {
                        const fieldInfo = otherOp.value.fields[0];
                        aggregateField = fieldInfo.destinationName || fieldInfo.sourceName || 'id';
                        break;
                    }
                }
                // Use AS to rename the aggregate column to the field name
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, `SELECT ${op.type.toUpperCase()}("${aggregateField}") AS "${aggregateField}" FROM`);
                break;

            case 'map':
                // Map operations are handled earlier when building the column selection
                // The actual field mapping/transformation happens in memory after the SQL query
                break;
        }
    }

    return { sql: currentQuery, params };
}
