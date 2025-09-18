import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression, ComparatorExpression, OperatorExpression, ValueExpression, PropertyExpression } from '@routier/core/expressions';

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
export function buildSelectFromExpression<TEntity extends {}>(options: {
    expression?: Expression,
    schema: CompiledSchema<TEntity>
}): { sql: string, params: any[] } {
    const { schema, expression } = options;
    const columns = schema.properties && schema.properties.length > 0
        ? schema.properties.map(p => `"${p.name}"`)
        : ['*'];
    if (!expression) {
        const sql = `SELECT ${columns.join(', ')} FROM "${schema.collectionName}"`;
        return { sql, params: [] };
    }
    const { where, params } = expressionToWhereClause(expression);
    const sql = `SELECT ${columns.join(', ')} FROM "${schema.collectionName}" WHERE ${where}`;
    return { sql, params };
}
