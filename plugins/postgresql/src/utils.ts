import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression, ComparatorExpression, OperatorExpression, ValueExpression, PropertyExpression } from '@routier/core/expressions';
import { IQuery, QueryField } from '@routier/core/plugins';
import { SchemaPersistChanges } from '@routier/core/collections';
import { SqlOperation } from './types';

/**
 * Maps schema types to PostgreSQL column types.
 */
const schemaTypeToPostgresType = (type: SchemaTypes): string => {
    switch (type) {
        case SchemaTypes.String:
            return 'TEXT';
        case SchemaTypes.Number:
            return 'NUMERIC';
        case SchemaTypes.Boolean:
            return 'BOOLEAN';
        case SchemaTypes.Date:
            return 'TIMESTAMP';
        case SchemaTypes.Object:
        case SchemaTypes.Array:
            return 'JSONB'; // PostgreSQL has native JSONB support
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
 * Converts a CompiledSchema to a PostgreSQL CREATE TABLE statement and index statements.
 * 
 * PostgreSQL-specific features:
 * - Uses SERIAL/BIGSERIAL for auto-incrementing integers
 * - Uses UUID extension for string identity keys
 * - Uses JSONB for nested objects/arrays
 * - Uses GIN indexes for JSONB columns
 */
export function compiledSchemaToPostgresTable(schema: CompiledSchema<any>, tableName?: string): string {
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
                colDef = `"${prop.name}" SERIAL PRIMARY KEY`;
            } else if (prop.type === SchemaTypes.String) {
                // Use UUID extension for string identity keys
                colDef = `"${prop.name}" UUID PRIMARY KEY DEFAULT gen_random_uuid()`;
            } else {
                colDef = `"${prop.name}" ${schemaTypeToPostgresType(prop.type)} PRIMARY KEY`;
            }
        } else if (isDeeplyNested(prop)) {
            colDef = `"${prop.name}" JSONB`;
        } else {
            colDef = `"${prop.name}" ${schemaTypeToPostgresType(prop.type)}`;
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
    // For JSONB columns, use GIN indexes
    for (const idxName in indexMap) {
        const props = indexMap[idxName];
        if (props.length === 1) {
            const prop = props[0];
            const idxSqlName = `${table}_${prop.name}_idx`;
            if (!usedIndexNames.has(idxSqlName)) {
                if (isDeeplyNested(prop)) {
                    // GIN index for JSONB
                    indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" USING GIN ("${prop.name}");`);
                } else {
                    indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" ("${prop.name}");`);
                }
                usedIndexNames.add(idxSqlName);
            }
        } else if (props.length > 1) {
            // Composite index
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
 * PostgreSQL-specific: Uses ILIKE for case-insensitive string matching, LIKE for case-sensitive.
 */
export function expressionToWhereClause(expr: Expression): { where: string, params: any[] } {
    const params: any[] = [];
    function walk(e: Expression): string {
        if (e.type === 'operator') {
            const op = (e as OperatorExpression).operator;
            const left = e.left ? walk(e.left) : '';
            const right = e.right ? walk(e.right) : '';

            let sqlOp: string;
            switch (op) {
                case '&&':
                    sqlOp = 'AND';
                    break;
                case '||':
                    sqlOp = 'OR';
                    break;
                default:
                    sqlOp = op;
                    break;
            }

            return `(${left} ${sqlOp} ${right})`;
        }
        if (e.type === 'comparator') {
            const cmp = e as ComparatorExpression;

            // Handle string operations - PostgreSQL uses LIKE/ILIKE
            if (cmp.comparator === 'starts-with' || cmp.comparator === 'ends-with' || cmp.comparator === 'includes') {
                if (cmp.comparator === 'includes') {
                    if (cmp.left.type === 'property' && cmp.right.type === 'value') {
                        const col = `"${(cmp.left as PropertyExpression).property.name}"`;
                        const value = (cmp.right as ValueExpression).value;

                        if (Array.isArray(value)) {
                            const placeholders = value.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
                            params.push(...value);
                            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
                        } else {
                            // PostgreSQL uses ILIKE for case-insensitive, LIKE for case-sensitive
                            params.push(`%${value}%`);
                            return cmp.negated ? `${col} NOT ILIKE $${params.length}` : `${col} ILIKE $${params.length}`;
                        }
                    } else if (cmp.left.type === 'value' && cmp.right.type === 'property') {
                        const col = `"${(cmp.right as PropertyExpression).property.name}"`;
                        const value = (cmp.left as ValueExpression).value;

                        if (Array.isArray(value)) {
                            const placeholders = value.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
                            params.push(...value);
                            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
                        } else {
                            params.push(`%${value}%`);
                            return cmp.negated ? `$${params.length} NOT ILIKE ${col}` : `$${params.length} ILIKE ${col}`;
                        }
                    }
                }

                // starts-with and ends-with
                if (cmp.left.type === 'property' && cmp.right.type === 'value') {
                    const col = `"${(cmp.left as PropertyExpression).property.name}"`;
                    const value = (cmp.right as ValueExpression).value;
                    let pattern: string;

                    switch (cmp.comparator) {
                        case 'starts-with':
                            pattern = `${value}%`;
                            break;
                        case 'ends-with':
                            pattern = `%${value}`;
                            break;
                        default:
                            pattern = `%${value}%`;
                    }

                    params.push(pattern);
                    return cmp.negated ? `${col} NOT ILIKE $${params.length}` : `${col} ILIKE $${params.length}`;
                } else if (cmp.left.type === 'value' && cmp.right.type === 'property') {
                    const col = `"${(cmp.right as PropertyExpression).property.name}"`;
                    const value = (cmp.left as ValueExpression).value;
                    let pattern: string;

                    switch (cmp.comparator) {
                        case 'starts-with':
                            pattern = `${value}%`;
                            break;
                        case 'ends-with':
                            pattern = `%${value}`;
                            break;
                        default:
                            pattern = `%${value}%`;
                    }

                    params.push(pattern);
                    return cmp.negated ? `$${params.length} NOT ILIKE ${col}` : `$${params.length} ILIKE ${col}`;
                }
            }

            // Handle null comparisons
            if (cmp.comparator === 'equals') {
                if (cmp.left.type === 'property' && cmp.right.type === 'value') {
                    const col = `"${(cmp.left as PropertyExpression).property.name}"`;
                    const value = (cmp.right as ValueExpression).value;

                    if (value === null) {
                        return cmp.negated ? `${col} IS NOT NULL` : `${col} IS NULL`;
                    }
                    params.push(value);
                    const paramNum = params.length;
                    return cmp.negated ? `${col} != $${paramNum}` : `${col} = $${paramNum}`;
                } else if (cmp.left.type === 'value' && cmp.right.type === 'property') {
                    const col = `"${(cmp.right as PropertyExpression).property.name}"`;
                    const value = (cmp.left as ValueExpression).value;

                    if (value === null) {
                        params.push(null); // Push null to maintain param count
                        const paramNum = params.length;
                        return cmp.negated ? `$${paramNum} IS NOT NULL` : `$${paramNum} IS NULL`;
                    }
                    params.push(value);
                    const paramNum = params.length;
                    return cmp.negated ? `$${paramNum} != ${col}` : `$${paramNum} = ${col}`;
                }
            }

            // Generic comparison
            const leftExpr = walk(cmp.left);
            const rightExpr = walk(cmp.right);

            switch (cmp.comparator) {
                case 'equals':
                    return cmp.negated ? `${leftExpr} != ${rightExpr}` : `${leftExpr} = ${rightExpr}`;
                case 'greater-than':
                    return cmp.negated ? `${leftExpr} <= ${rightExpr}` : `${leftExpr} > ${rightExpr}`;
                case 'greater-than-equals':
                    return cmp.negated ? `${leftExpr} < ${rightExpr}` : `${leftExpr} >= ${rightExpr}`;
                case 'less-than':
                    return cmp.negated ? `${leftExpr} >= ${rightExpr}` : `${leftExpr} < ${rightExpr}`;
                case 'less-than-equals':
                    return cmp.negated ? `${leftExpr} > ${rightExpr}` : `${leftExpr} <= ${rightExpr}`;
                default:
                    throw new Error(`Unsupported comparator: ${cmp.comparator}`);
            }
        }
        if (e.type === 'property') {
            return `"${(e as PropertyExpression).property.name}"`;
        }
        if (e.type === 'value') {
            params.push((e as ValueExpression).value);
            return `$${params.length}`;
        }
        throw new Error(`Unknown expression type: ${e.type}`);
    }
    const where = walk(expr);
    return { where, params };
}

/**
 * Builds a SELECT statement from a table, an Expression, and optional columns.
 */
export function buildSelectFromExpression<TEntity extends {}, TShape>(options: {
    query: IQuery<TEntity, TShape>,
    schema: CompiledSchema<TEntity>
}): { sql: string, params: any[] } {
    const { schema, query } = options;
    const columns = schema.properties && schema.properties.length > 0
        ? schema.properties.map(p => `"${p.name}"`)
        : ['*'];

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

    const allColumns = schema.properties.map(p => `"${p.name}"`);
    const allColumnStr = allColumns.join(', ');

    const insertColumns = schema.properties
        .filter(p => !p.isIdentity)
        .map(p => `"${p.name}"`);
    const insertColumnStr = insertColumns.join(', ');

    // Handle INSERT operations (adds)
    let addsOperation: SqlOperation | null = null;
    if (adds.length > 0) {
        const placeholders = adds.map((_, idx) =>
            `(${insertColumns.map((_, colIdx) => `$${idx * insertColumns.length + colIdx + 1}`).join(', ')})`
        ).join(', ');

        // PostgreSQL uses RETURNING clause
        const insertSql = `INSERT INTO "${collectionName}" (${insertColumnStr}) VALUES ${placeholders} RETURNING ${allColumnStr}`;

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
        const updateGroups = new Map<string, typeof updates>();

        for (const update of updates) {
            const deltaKeys = Object.keys(update.delta).sort().join(',');
            if (!updateGroups.has(deltaKeys)) {
                updateGroups.set(deltaKeys, []);
            }
            updateGroups.get(deltaKeys)!.push(update);
        }

        const statements: string[] = [];
        const allParams: any[] = [];
        let paramCounter = 1;

        for (const [, groupUpdates] of updateGroups) {
            const firstUpdate = groupUpdates[0];
            let deltaKeys = Object.keys(firstUpdate.delta);

            if (deltaKeys.length === 0) {
                const entityKeys = Object.keys(firstUpdate.entity);
                const identityKeys = schema.idProperties.map(p => p.name);
                deltaKeys = entityKeys.filter(key => !identityKeys.includes(key));
            }

            const setClauses: string[] = [];
            const idColumns = schema.idProperties.map(p => p.name);
            const idColumn = idColumns[0];

            for (const key of deltaKeys) {
                let caseStatement = `"${key}" = CASE "${idColumn}"`;

                for (const update of groupUpdates) {
                    const idValue = schema.idProperties[0].getValue(update.entity);
                    caseStatement += ` WHEN $${paramCounter++} THEN $${paramCounter++}`;
                    allParams.push(idValue);

                    const value = Object.keys(update.delta).length === 0
                        ? update.entity[key]
                        : update.delta[key];
                    allParams.push(value);
                }

                caseStatement += ` ELSE "${key}" END`;
                setClauses.push(caseStatement);
            }

            const idPlaceholders = groupUpdates.map(() => {
                const placeholder = `$${paramCounter++}`;
                return placeholder;
            }).join(', ');

            for (const update of groupUpdates) {
                const idValue = schema.idProperties[0].getValue(update.entity);
                allParams.push(idValue);
            }

            const updateSql = `UPDATE "${collectionName}" SET ${setClauses.join(', ')} WHERE "${idColumn}" IN (${idPlaceholders}) RETURNING ${allColumnStr}`;
            statements.push(updateSql);
        }

        if (statements.length > 0) {
            updatesOperation = { sql: statements.join('; '), params: allParams };
        }
    }

    // Handle DELETE operations (removes)
    let removesOperation: SqlOperation | null = null;
    if (removes.length > 0) {
        const idProperties = schema.idProperties;
        const whereClauses: string[] = [];
        const allParams: any[] = [];
        let paramCounter = 1;

        for (const remove of removes) {
            const entityWhereClauses: string[] = [];

            for (const idProperty of idProperties) {
                const idValue = idProperty.getValue(remove);
                entityWhereClauses.push(`"${idProperty.name}" = $${paramCounter++}`);
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
 * Builds a complete SQL query from an IQuery object for PostgreSQL.
 */
export function buildFromQueryOperation<TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>): SqlOperation {
    const { schema, options } = query;
    const tableName = schema.collectionName;

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

    let columnsStr: string;
    if (mapFields && mapFields.length > 0) {
        columnsStr = `"${mapFields[0].sourceName}"`;
        for (let i = 1; i < mapFields.length; i++) {
            columnsStr += `, "${mapFields[i].sourceName}"`;
        }
    } else {
        const columnCount = schema.properties.length;
        if (columnCount === 0) {
            throw new Error("Need to select at least one column, found zero");
        }

        columnsStr = `"${schema.properties[0].name}"`;
        for (let i = 1; i < columnCount; i++) {
            columnsStr += `, "${schema.properties[i].name}"`;
        }
    }

    const params: any[] = [];
    let paramCounter = 1;
    let currentQuery = `SELECT ${columnsStr} FROM "${tableName}"`;

    const operations: Array<{ type: string, value: any, index: number }> = [];
    let totalOps = 0;
    for (const [, items] of options.items) {
        totalOps += items.length;
    }
    operations.length = totalOps;

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

    operations.sort((a, b) => a.index - b.index);

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

    // Build WHERE clause
    let hasWhereClause = false;
    for (const op of filterOps) {
        const filterExpr = op.value.expression;
        if (filterExpr) {
            const { where, params: filterParams } = expressionToWhereClause(filterExpr);
            // expressionToWhereClause already uses $N placeholders, but we need to renumber them
            let pgWhere = where;
            for (const param of filterParams) {
                pgWhere = pgWhere.replace(/\$(\d+)/g, (match, num) => {
                    return `$${paramCounter++}`;
                });
                params.push(param);
            }

            if (!hasWhereClause) {
                currentQuery += ` WHERE ${pgWhere}`;
                hasWhereClause = true;
            } else {
                currentQuery += ` AND ${pgWhere}`;
            }
        }
    }

    // Build ORDER BY
    for (const op of sortOps) {
        const sortProp = op.value.propertyName;
        const sortDir = op.value.direction === 'asc' ? 'ASC' : 'DESC';
        currentQuery += ` ORDER BY "${sortProp}" ${sortDir}`;
    }

    // Handle skip/take
    let skipValue: number | null = null;
    let takeValue: number | null = null;

    for (const op of skipTakeOps) {
        if (op.type === 'skip') {
            skipValue = op.value;
        } else if (op.type === 'take') {
            takeValue = op.value;
        }
    }

    if (skipValue !== null || takeValue !== null) {
        if (skipValue !== null && takeValue !== null) {
            currentQuery += ` LIMIT ${takeValue} OFFSET ${skipValue}`;
        } else if (skipValue !== null) {
            currentQuery += ` OFFSET ${skipValue}`;
        } else if (takeValue !== null) {
            currentQuery += ` LIMIT ${takeValue}`;
        }
    }

    // Handle other operations
    for (const op of otherOps) {
        switch (op.type) {
            case 'distinct':
                if (currentQuery.includes('SELECT * FROM')) {
                    currentQuery = currentQuery.replace('SELECT *', 'SELECT DISTINCT *');
                } else if (currentQuery.includes('SELECT ')) {
                    currentQuery = currentQuery.replace('SELECT ', 'SELECT DISTINCT ');
                }
                break;

            case 'count':
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, 'SELECT COUNT(*) AS "count" FROM');
                break;

            case 'min':
            case 'max':
            case 'sum':
                let aggregateField = 'id';
                for (const otherOp of otherOps) {
                    if (otherOp.type === 'map' && otherOp.value.fields && otherOp.value.fields.length > 0) {
                        const fieldInfo = otherOp.value.fields[0];
                        aggregateField = fieldInfo.destinationName || fieldInfo.sourceName || 'id';
                        break;
                    }
                }
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, `SELECT ${op.type.toUpperCase()}("${aggregateField}") AS "${aggregateField}" FROM`);
                break;

            case 'map':
                break;
        }
    }

    return { sql: currentQuery, params };
}
