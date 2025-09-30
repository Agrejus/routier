import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression, ComparatorExpression, OperatorExpression, ValueExpression, PropertyExpression } from '@routier/core/expressions';
import { IQuery } from '@routier/core/plugins';
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
            return 'JSON'; // Use JSON for deeply nested structures
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

    for (const prop of schema.properties) {
        let colDef: string;

        if (singleIdentityPK && prop.name === singleIdentityPK.name) {
            if (prop.type === SchemaTypes.Number) {
                colDef = `"${prop.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
            } else if (prop.type === SchemaTypes.String) {
                colDef = `"${prop.name}" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))))`;
            } else {
                colDef = `"${prop.name}" ${schemaTypeToSqliteType(prop.type)} PRIMARY KEY`;
            }
        } else if (isDeeplyNested(prop)) {
            colDef = `"${prop.name}" JSON`;
        } else {
            colDef = `"${prop.name}" ${schemaTypeToSqliteType(prop.type)}`;
        }

        columns.push(colDef);
    }

    // Composite PK logic
    let pkClause = '';
    if ((!singleIdentityPK) && idProps.length > 0) {
        const pkCols = idProps.map(p => `"${p.name}"`);
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
                indexStatements.push(`CREATE UNIQUE INDEX IF NOT EXISTS "${idxName}" ON "${table}" ("${prop.name}");`);
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
                indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" ("${props[0].name}");`);
                usedIndexNames.add(idxSqlName);
            }
        } else if (props.length > 1) {
            // Composite (clustered) index
            const idxSqlName = `${table}_${idxName}_clustered_idx`;
            const colList = props.map(p => `"${p.name}"`).join(', ');
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
 * Translates an Expression tree to a SQL WHERE clause and parameters.
 * Supports logical operators, comparators, property paths, and values.
 *
 * @param expr The Expression to translate.
 * @returns An object with { where: string, params: any[] }
 */
export function expressionToWhereClause(expr: Expression): { where: string, params: any[] } {
    const params: any[] = [];
    function walk(e: Expression): string {
        if (e.type === 'operator') {
            const op = (e as OperatorExpression).operator;
            const left = e.left ? walk(e.left) : '';
            const right = e.right ? walk(e.right) : '';
            return `(${left} ${op} ${right})`;
        }
        if (e.type === 'comparator') {
            const cmp = e as ComparatorExpression;
            const left = cmp.left as PropertyExpression;
            const right = cmp.right as ValueExpression;
            const col = `"${left.property.name}"`;
            switch (cmp.comparator) {
                case 'equals':
                    // Handle null comparisons properly
                    if (right.value === null) {
                        return cmp.negated ? `${col} IS NOT NULL` : `${col} IS NULL`;
                    }
                    params.push(right.value);
                    return cmp.negated ? `${col} != ?` : `${col} = ?`;
                case 'starts-with':
                    params.push(`${right.value}%`);
                    return cmp.negated ? `${col} NOT LIKE ?` : `${col} LIKE ?`;
                case 'ends-with':
                    params.push(`%${right.value}`);
                    return cmp.negated ? `${col} NOT LIKE ?` : `${col} LIKE ?`;
                case 'includes':
                    params.push(`%${right.value}%`);
                    return cmp.negated ? `${col} NOT LIKE ?` : `${col} LIKE ?`;
                case 'greater-than':
                    params.push(right.value);
                    return cmp.negated ? `${col} <= ?` : `${col} > ?`;
                case 'greater-than-equals':
                    params.push(right.value);
                    return cmp.negated ? `${col} < ?` : `${col} >= ?`;
                case 'less-than':
                    params.push(right.value);
                    return cmp.negated ? `${col} >= ?` : `${col} < ?`;
                case 'less-than-equals':
                    params.push(right.value);
                    return cmp.negated ? `${col} > ?` : `${col} <= ?`;
                default:
                    throw new Error(`Unsupported comparator: ${cmp.comparator}`);
            }
        }
        if (e.type === 'property') {
            return `"${(e as PropertyExpression).property.name}"`;
        }
        if (e.type === 'value') {
            params.push((e as ValueExpression).value);
            return '?';
        }
        throw new Error(`Unknown expression type: ${(e as any).type}`);
    }
    const where = walk(expr);
    return { where, params };
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
        ? schema.properties.map(p => `"${p.name}"`)
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
    updates: SqlOperation | null;
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
        return { adds: null, updates: null, removes: null };
    }

    // Get column names from schema properties, excluding identity columns for INSERT
    const allColumns = schema.properties.map(p => `"${p.name}"`);
    const allColumnStr = allColumns.join(', ');

    // For INSERT operations, exclude identity columns (they're auto-generated)
    const insertColumns = schema.properties
        .filter(p => !p.isIdentity)
        .map(p => `"${p.name}"`);
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
            for (const col of schema.properties) {
                if (!col.isIdentity) {
                    addParams.push(add[col.name]);
                }
            }
        }

        addsOperation = { sql: insertSql, params: addParams };
    }

    // Handle UPDATE operations (updates)
    let updatesOperation: SqlOperation | null = null;
    if (updates.length > 0) {
        // Group updates by which columns they're changing
        const updateGroups = new Map<string, typeof updates>();

        for (const update of updates) {
            const deltaKeys = Object.keys(update.delta).sort().join(',');
            if (!updateGroups.has(deltaKeys)) {
                updateGroups.set(deltaKeys, []);
            }
            updateGroups.get(deltaKeys)!.push(update);
        }

        // Build a separate UPDATE statement for each group
        const statements: string[] = [];
        const allParams: any[] = [];

        for (const [, groupUpdates] of updateGroups) {
            const firstUpdate = groupUpdates[0];
            const deltaKeys = Object.keys(firstUpdate.delta);

            // Build SET clause with CASE statements for each column
            const setClauses: string[] = [];

            // Get ID column names
            const idColumns = schema.idProperties.map(p => p.name);
            const idColumn = idColumns[0]; // Use first ID for CASE matching

            for (const key of deltaKeys) {
                let caseStatement = `"${key}" = CASE "${idColumn}"`;

                for (const update of groupUpdates) {
                    const idValue = schema.idProperties[0].getValue(update.entity);
                    caseStatement += ` WHEN ? THEN ?`;
                    allParams.push(idValue);
                    allParams.push(update.delta[key]);
                }

                caseStatement += ` ELSE "${key}" END`;
                setClauses.push(caseStatement);
            }

            // Build WHERE clause for all IDs in this group
            const idPlaceholders = groupUpdates.map(() => '?').join(', ');
            for (const update of groupUpdates) {
                const idValue = schema.idProperties[0].getValue(update.entity);
                allParams.push(idValue);
            }

            const updateSql = `UPDATE "${collectionName}" SET ${setClauses.join(', ')} WHERE "${idColumn}" IN (${idPlaceholders}) RETURNING ${allColumnStr}`;
            statements.push(updateSql);
        }

        if (statements.length > 0) {
            // Join multiple statements with semicolon only if there are multiple groups
            updatesOperation = { sql: statements.join('; '), params: allParams };
        }
    }

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
                entityWhereClauses.push(`"${idProperty.name}" = ?`);
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
        updates: updatesOperation,
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
    debugger;
    // Pre-compute column string once
    const columnCount = schema.properties.length;
    if (columnCount === 0) {
        throw new Error("Need to select at least one column, found zero");
    }

    // Use string concatenation instead of array join for better performance
    let columnsStr = `"${schema.properties[0].name}"`;
    for (let i = 1; i < columnCount; i++) {
        columnsStr += `, "${schema.properties[i].name}"`;
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
    for (const op of skipTakeOps) {
        if (op.type === 'skip') {
            subqueryCount++;
            currentQuery = `SELECT ${columnsStr} FROM (${currentQuery}) AS subquery_${subqueryCount} OFFSET ${op.value}`;
        } else if (op.type === 'take') {
            if (subqueryCount > 0) {
                subqueryCount++;
                currentQuery = `SELECT ${columnsStr} FROM (${currentQuery}) AS subquery_${subqueryCount} LIMIT ${op.value}`;
            } else {
                currentQuery += ` LIMIT ${op.value}`;
            }
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
                // Replace SELECT with COUNT
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, 'SELECT COUNT(*) FROM');
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
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, `SELECT ${op.type.toUpperCase()}("${aggregateField}") FROM`);
                break;

            case 'map':
                // Map operations typically need to be handled in memory after the SQL query
                // since they involve JavaScript functions
                break;
        }
    }

    return { sql: currentQuery, params };
}
