import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression, ComparatorExpression, OperatorExpression, ValueExpression, PropertyExpression } from '@routier/core/expressions';
import { IQuery, QueryField } from '@routier/core/plugins';
import { SchemaPersistChanges } from '@routier/core/collections';
import { buildGroupedUpdateOperations, getDialect, sqlColumnProperties, toColumnValueMap } from '@routier/sql-plugin-core';
import { uuidv4 } from '@routier/core/utilities';
import { MysqlAddsOperation, MysqlRemovesOperation, MysqlSelectBack, MysqlUpdatesOperation, SqlOperation } from './types';

/**
 * Maps schema types to MySQL column types.
 */
const schemaTypeToMysqlType = (type: SchemaTypes): string => {
    switch (type) {
        case SchemaTypes.String:
            return 'VARCHAR(255)';
        case SchemaTypes.Number:
            return 'DECIMAL(20, 10)';
        case SchemaTypes.Boolean:
            return 'BOOLEAN';
        case SchemaTypes.Date:
            return 'DATETIME';
        case SchemaTypes.Object:
        case SchemaTypes.Array:
            // One source of truth for this engine's JSON type: the same dialect value
            // toColumnAssignments encodes against, so DDL and DML cannot drift apart.
            return getDialect('mysql').jsonColumnType;
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
 * Converts a CompiledSchema to a MySQL CREATE TABLE statement and index statements.
 * 
 * MySQL-specific features:
 * - Uses AUTO_INCREMENT for auto-incrementing integers
 * - Uses UUID() function for string identity keys
 * - Uses JSON type for nested objects/arrays (MySQL 5.7+)
 * - Uses InnoDB engine
 */
export function compiledSchemaToMysqlTable(schema: CompiledSchema<any>, tableName?: string): string {
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
                colDef = `\`${prop.getResolvedName()}\` INT AUTO_INCREMENT PRIMARY KEY`;
            } else if (prop.type === SchemaTypes.String) {
                // Use UUID() function for string identity keys
                colDef = `\`${prop.getResolvedName()}\` VARCHAR(36) PRIMARY KEY DEFAULT (UUID())`;
            } else {
                colDef = `\`${prop.getResolvedName()}\` ${schemaTypeToMysqlType(prop.type)} PRIMARY KEY`;
            }
        } else if (isDeeplyNested(prop)) {
            colDef = `\`${prop.getResolvedName()}\` JSON`;
        } else {
            colDef = `\`${prop.getResolvedName()}\` ${schemaTypeToMysqlType(prop.type)}`;
        }

        columns.push(colDef);
    }

    // Composite PK logic
    let pkClause = '';
    if ((!singleIdentityPK) && idProps.length > 0) {
        const pkCols = idProps.map(p => `\`${p.getResolvedName()}\``);
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
                indexStatements.push(`CREATE UNIQUE INDEX \`${idxName}\` ON \`${table}\` (\`${prop.name}\`);`);
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
            const idxSqlName = `${table}_${props[0].name}_idx`;
            if (!usedIndexNames.has(idxSqlName)) {
                indexStatements.push(`CREATE INDEX \`${idxSqlName}\` ON \`${table}\` (\`${props[0].name}\`);`);
                usedIndexNames.add(idxSqlName);
            }
        } else if (props.length > 1) {
            const idxSqlName = `${table}_${idxName}_clustered_idx`;
            const colList = props.map(p => `\`${p.name}\``).join(', ');
            if (!usedIndexNames.has(idxSqlName)) {
                indexStatements.push(`CREATE INDEX \`${idxSqlName}\` ON \`${table}\` (${colList});`);
                usedIndexNames.add(idxSqlName);
            }
        }
    }

    const sql = `CREATE TABLE IF NOT EXISTS \`${table}\` (
  ${columns.join(',\n  ')}${pkClause}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
${indexStatements.join('\n')}`;
    return sql;
}

/**
 * Translates an Expression tree to a SQL WHERE clause and parameters.
 * MySQL-specific: Uses LIKE for case-insensitive matching (with COLLATE utf8mb4_general_ci).
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

            // Handle string operations - MySQL uses LIKE (case-insensitive by default with utf8mb4_general_ci)
            if (cmp.comparator === 'starts-with' || cmp.comparator === 'ends-with' || cmp.comparator === 'includes') {
                if (cmp.comparator === 'includes') {
                    if (cmp.left.type === 'property' && cmp.right.type === 'value') {
                        const col = `\`${(cmp.left as PropertyExpression).property.name}\``;
                        const value = (cmp.right as ValueExpression).value;

                        if (Array.isArray(value)) {
                            const placeholders = value.map(() => '?').join(', ');
                            params.push(...value);
                            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
                        } else {
                            params.push(`%${value}%`);
                            return cmp.negated ? `${col} NOT LIKE ?` : `${col} LIKE ?`;
                        }
                    } else if (cmp.left.type === 'value' && cmp.right.type === 'property') {
                        const col = `\`${(cmp.right as PropertyExpression).property.name}\``;
                        const value = (cmp.left as ValueExpression).value;

                        if (Array.isArray(value)) {
                            const placeholders = value.map(() => '?').join(', ');
                            params.push(...value);
                            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
                        } else {
                            params.push(`%${value}%`);
                            return cmp.negated ? `? NOT LIKE ${col}` : `? LIKE ${col}`;
                        }
                    }
                }

                // starts-with and ends-with
                if (cmp.left.type === 'property' && cmp.right.type === 'value') {
                    const col = `\`${(cmp.left as PropertyExpression).property.name}\``;
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
                    return cmp.negated ? `${col} NOT LIKE ?` : `${col} LIKE ?`;
                } else if (cmp.left.type === 'value' && cmp.right.type === 'property') {
                    const col = `\`${(cmp.right as PropertyExpression).property.name}\``;
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
                    return cmp.negated ? `? NOT LIKE ${col}` : `? LIKE ${col}`;
                }
            }

            // Handle null comparisons
            if (cmp.comparator === 'equals') {
                if (cmp.left.type === 'property' && cmp.right.type === 'value') {
                    const col = `\`${(cmp.left as PropertyExpression).property.name}\``;
                    const value = (cmp.right as ValueExpression).value;

                    if (value === null) {
                        return cmp.negated ? `${col} IS NOT NULL` : `${col} IS NULL`;
                    }
                    params.push(value);
                    return cmp.negated ? `${col} != ?` : `${col} = ?`;
                } else if (cmp.left.type === 'value' && cmp.right.type === 'property') {
                    const col = `\`${(cmp.right as PropertyExpression).property.name}\``;
                    const value = (cmp.left as ValueExpression).value;

                    if (value === null) {
                        return cmp.negated ? `? IS NOT NULL` : `? IS NULL`;
                    }
                    params.push(value);
                    return cmp.negated ? `? != ${col}` : `? = ${col}`;
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
            return `\`${(e as PropertyExpression).property.name}\``;
        }
        if (e.type === 'value') {
            params.push((e as ValueExpression).value);
            return '?';
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
    // Root properties only, storage-side names — same layout the DDL creates
    const columnProperties = sqlColumnProperties(schema);
    const columns = columnProperties.length > 0
        ? columnProperties.map(p => `\`${p.getResolvedName()}\``)
        : ['*'];

    const filterOptions = query.options.get('filter');
    if (!filterOptions || filterOptions.length === 0) {
        const sql = `SELECT ${columns.join(', ')} FROM \`${schema.collectionName}\``;
        return { sql, params: [] };
    }

    const firstFilter = filterOptions[0].option.value;
    const { where, params } = expressionToWhereClause(firstFilter.expression);
    const sql = `SELECT ${columns.join(', ')} FROM \`${schema.collectionName}\` WHERE ${where}`;
    return { sql, params };
}

export function buildFromPersistOperation<TEntity extends {}>(schema: CompiledSchema<TEntity>, changes: SchemaPersistChanges<Record<string, unknown>>): {
    adds: MysqlAddsOperation | null;
    updates: MysqlUpdatesOperation[];
    removes: MysqlRemovesOperation | null;
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

    // Column identifiers are storage-side names (PropertyInfo.from ?? name), one column per
    // ROOT property: a nested subtree is stored as a single JSON column named for its root.
    const columnProperties = sqlColumnProperties(schema);
    const allColumnStr = columnProperties.map(p => `\`${p.getResolvedName()}\``).join(', ');
    const idProperties = schema.idProperties;
    const singleIdentity = idProperties.length === 1 && idProperties[0].isIdentity ? idProperties[0] : undefined;
    // A string identity has a server-side DEFAULT (UUID()), but a value the server generates
    // cannot be read back without RETURNING — so this plugin generates it client-side and
    // sends it, which makes the inserted keys knowable and the echo exact.
    const clientGeneratedIdentity = singleIdentity != null && singleIdentity.type === SchemaTypes.String
        ? singleIdentity
        : undefined;

    // Handle INSERT operations (adds).
    // MySQL has no RETURNING; each add operation carries how to select its rows back.
    let addsOperation: MysqlAddsOperation | null = null;
    if (adds.length > 0) {
        const insertProperties = columnProperties.filter(p => !p.isIdentity || p === clientGeneratedIdentity);
        const insertColumns = insertProperties.map(p => `\`${p.getResolvedName()}\``);
        const insertColumnStr = insertColumns.join(', ');

        const placeholders = adds.map(() =>
            `(${insertColumns.map(() => '?').join(', ')})`
        ).join(', ');

        const insertSql = `INSERT INTO \`${collectionName}\` (${insertColumnStr}) VALUES ${placeholders}`;

        const generatedIds: unknown[] = [];
        const addParams: any[] = [];
        for (const add of adds) {
            // Routed through the same column resolution the UPDATE path uses, so a nested
            // object or array is JSON-encoded rather than handed to the driver as a structure.
            const values = toColumnValueMap(add as Record<string, unknown>, schema, getDialect('mysql'));
            const generatedId = clientGeneratedIdentity != null ? uuidv4() : undefined;

            if (generatedId != null) {
                generatedIds.push(generatedId);
            }

            for (const col of insertProperties) {
                if (col === clientGeneratedIdentity) {
                    addParams.push(generatedId);
                } else {
                    addParams.push(values.get(col.getResolvedName()));
                }
            }
        }

        let selectBack: MysqlSelectBack;

        if (clientGeneratedIdentity != null) {
            selectBack = { mode: 'by-key', ids: generatedIds };
        } else if (singleIdentity != null) {
            // Single numeric AUTO_INCREMENT key: a simple multi-row INSERT allocates a
            // consecutive id block (even under innodb_autoinc_lock_mode=2), so the rows
            // are insertId .. insertId + rowCount - 1.
            selectBack = { mode: 'insert-id', rowCount: adds.length };
        } else if (idProperties.length === 1) {
            const keyColumn = idProperties[0].getResolvedName();
            selectBack = { mode: 'by-key', ids: adds.map(add => add[keyColumn]) };
        } else {
            selectBack = {
                mode: 'by-composite-key',
                keyTuples: adds.map(add => Object.fromEntries(
                    idProperties.map(p => [p.getResolvedName(), add[p.getResolvedName()]])
                )),
            };
        }

        addsOperation = { sql: insertSql, params: addParams, selectBack };
    }

    // Handle UPDATE operations (updates). One operation per changed-column group — the
    // shared builder resolves deltas to columns (renames, JSON encoding, empty-delta
    // fallback) and never joins groups with ';', which mysql2 rejects by default
    // (multipleStatements is off). Each group carries its row ids for the select-back.
    const updatesOperations: MysqlUpdatesOperation[] = buildGroupedUpdateOperations(
        schema,
        updates as { entity: Record<string, unknown>; delta: Record<string, unknown> }[],
        getDialect('mysql')
    );

    // Handle DELETE operations (removes)
    let removesOperation: MysqlRemovesOperation | null = null;
    if (removes.length > 0) {
        const whereClauses: string[] = [];
        const allParams: any[] = [];

        for (const remove of removes) {
            const entityWhereClauses: string[] = [];

            for (const idProperty of idProperties) {
                const idValue = idProperty.getValue(remove);
                entityWhereClauses.push(`\`${idProperty.getResolvedName()}\` = ?`);
                allParams.push(idValue);
            }

            whereClauses.push(`(${entityWhereClauses.join(' AND ')})`);
        }

        const whereClause = whereClauses.join(' OR ');
        // MySQL has no RETURNING: the plugin runs selectSql (same params) BEFORE the
        // delete, because afterwards the rows are gone and the echo would be empty.
        removesOperation = {
            sql: `DELETE FROM \`${collectionName}\` WHERE ${whereClause}`,
            params: allParams,
            selectSql: `SELECT ${allColumnStr} FROM \`${collectionName}\` WHERE ${whereClause}`,
        };
    }

    return {
        adds: addsOperation,
        updates: updatesOperations,
        removes: removesOperation
    };
}

/**
 * Builds a complete SQL query from an IQuery object for MySQL.
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
        columnsStr = `\`${mapFields[0].sourceName}\``;
        for (let i = 1; i < mapFields.length; i++) {
            columnsStr += `, \`${mapFields[i].sourceName}\``;
        }
    } else {
        // Root properties only, storage-side names — the layout the DDL creates. A column
        // per descendant would select phantom columns the table does not have.
        const columnProperties = sqlColumnProperties(schema);
        const columnCount = columnProperties.length;
        if (columnCount === 0) {
            throw new Error("Need to select at least one column, found zero");
        }

        columnsStr = `\`${columnProperties[0].getResolvedName()}\``;
        for (let i = 1; i < columnCount; i++) {
            columnsStr += `, \`${columnProperties[i].getResolvedName()}\``;
        }
    }

    const params: any[] = [];
    let currentQuery = `SELECT ${columnsStr} FROM \`${tableName}\``;

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
            params.push(...filterParams);

            if (!hasWhereClause) {
                currentQuery += ` WHERE ${where}`;
                hasWhereClause = true;
            } else {
                currentQuery += ` AND ${where}`;
            }
        }
    }

    // Build ORDER BY
    for (const op of sortOps) {
        const sortProp = op.value.propertyName;
        const sortDir = op.value.direction === 'asc' ? 'ASC' : 'DESC';
        currentQuery += ` ORDER BY \`${sortProp}\` ${sortDir}`;
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
            currentQuery += ` LIMIT 18446744073709551615 OFFSET ${skipValue}`; // MySQL requires LIMIT before OFFSET
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
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, 'SELECT COUNT(*) AS `count` FROM');
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
                currentQuery = currentQuery.replace(/SELECT .*? FROM/, `SELECT ${op.type.toUpperCase()}(\`${aggregateField}\`) AS \`${aggregateField}\` FROM`);
                break;

            case 'map':
                break;
        }
    }

    return { sql: currentQuery, params };
}
