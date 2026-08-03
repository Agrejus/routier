import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression } from '@routier/core/expressions';
import { IQuery, QueryField } from '@routier/core/plugins';
import { SchemaPersistChanges } from '@routier/core/collections';
import { buildConditionalUpdateOperations, buildGroupedUpdateOperations, getDialect, sqlColumnProperties, toColumnValueMap, toSql, SqlDialect } from '@routier/sql-plugin-core';
import { SqlOperation } from './types';

/**
 * Maps schema types to PostgreSQL column types.
 */
const schemaTypeToPostgresType = (type: SchemaTypes): string => {
    switch (type) {
        case SchemaTypes.String:
            return 'TEXT';
        case SchemaTypes.Number:
            // DOUBLE PRECISION matches the JS number type and comes back from the pg
            // driver as a number; NUMERIC is arbitrary-precision and returns strings
            return 'DOUBLE PRECISION';
        case SchemaTypes.Boolean:
            return 'BOOLEAN';
        case SchemaTypes.Date:
            return 'TIMESTAMP';
        case SchemaTypes.Object:
        case SchemaTypes.Array:
            // One source of truth for this engine's JSON type: the same dialect value
            // toColumnAssignments encodes against, so DDL and DML cannot drift apart.
            return getDialect('postgresql').jsonColumnType;
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

    // Root properties only: a nested subtree is ONE JSON column named for its root.
    // Iterating every property would emit a column per descendant, named by its leaf.
    for (const prop of sqlColumnProperties(schema)) {
        let colDef: string;

        if (singleIdentityPK && prop.name === singleIdentityPK.name) {
            if (prop.type === SchemaTypes.Number) {
                colDef = `"${prop.getResolvedName()}" SERIAL PRIMARY KEY`;
            } else if (prop.type === SchemaTypes.String) {
                // Use UUID extension for string identity keys
                colDef = `"${prop.getResolvedName()}" UUID PRIMARY KEY DEFAULT gen_random_uuid()`;
            } else {
                colDef = `"${prop.getResolvedName()}" ${schemaTypeToPostgresType(prop.type)} PRIMARY KEY`;
            }
        } else if (isDeeplyNested(prop)) {
            colDef = `"${prop.getResolvedName()}" JSONB`;
        } else {
            colDef = `"${prop.getResolvedName()}" ${schemaTypeToPostgresType(prop.type)}`;
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
    // For JSONB columns, use GIN indexes
    for (const idxName in indexMap) {
        const props = indexMap[idxName];
        if (props.length === 1) {
            const prop = props[0];
            const idxSqlName = `${table}_${prop.name}_idx`;
            if (!usedIndexNames.has(idxSqlName)) {
                if (isDeeplyNested(prop)) {
                    // GIN index for JSONB
                    indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" USING GIN ("${prop.getResolvedName()}");`);
                } else {
                    indexStatements.push(`CREATE INDEX IF NOT EXISTS "${idxSqlName}" ON "${table}" ("${prop.getResolvedName()}");`);
                }
                usedIndexNames.add(idxSqlName);
            }
        } else if (props.length > 1) {
            // Composite index
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
 * A postgres dialect whose placeholders start after `offset` already-bound parameters,
 * so several WHERE fragments can share one parameter list without renumbering.
 */
const offsetPostgresDialect = (offset: number): SqlDialect => {
    const base = getDialect('postgresql');
    return {
        ...base,
        getPlaceholder: (i: number) => `$${offset + i + 1}`,
    };
};

/**
 * Translates an Expression tree to a SQL WHERE clause and parameters.
 * @deprecated Use `toSql(expr, 'postgresql')` from `@routier/sql-plugin-core` for dialect-agnostic SQL.
 */
export function expressionToWhereClause(expr: Expression): { where: string, params: any[] } {
    const { where, params } = toSql(expr, 'postgresql');
    return { where, params: params as any[] };
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
        ? columnProperties.map(p => `"${p.getResolvedName()}"`)
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

    // Column identifiers are storage-side names (PropertyInfo.from ?? name), one column per
    // ROOT property: the entities handed to bulkPersist are wire-shaped, and a nested
    // subtree is stored as a single JSON column named for its root.
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
        const placeholders = adds.map((_, idx) =>
            `(${insertColumns.map((_, colIdx) => `$${idx * insertColumns.length + colIdx + 1}`).join(', ')})`
        ).join(', ');

        // PostgreSQL uses RETURNING clause
        const insertSql = `INSERT INTO "${collectionName}" (${insertColumnStr}) VALUES ${placeholders} RETURNING ${allColumnStr}`;

        const addParams: any[] = [];
        for (const add of adds) {
            // Routed through the same column resolution the UPDATE path uses, so a nested
            // object or array is JSON-encoded here too rather than handed to the driver as
            // a structure — `pg` encodes a JS array as a Postgres array literal (`{x,y}`),
            // which a json/jsonb column rejects.
            const values = toColumnValueMap(add as Record<string, unknown>, schema, getDialect('postgresql'));

            for (const col of insertProperties) {
                addParams.push(values.get(col.getResolvedName()));
            }
        }

        addsOperation = { sql: insertSql, params: addParams };
    }

    // Handle UPDATE operations (updates). One SqlOperation per changed-column group — the
    // shared builder resolves deltas to columns (renames, JSON encoding, empty-delta
    // fallback) and never joins groups with ';', which PostgreSQL's extended query protocol
    // rejects outright (defect #22).
    // Schemas with a `.concurrency()` token take one CONDITIONAL statement per row
    // instead of the grouped CASE form, so a stale write affects zero rows and is
    // reported as a conflict on that exact row.
    const hasConcurrencyChecks = updates.some(u => (u as { concurrency?: unknown }).concurrency != null);
    const updatesOperations: SqlOperation[] = hasConcurrencyChecks
        ? buildConditionalUpdateOperations(
            schema,
            updates as { entity: Record<string, unknown>; delta: Record<string, unknown> }[],
            getDialect('postgresql'),
            { suffix: ` RETURNING ${allColumnStr}` }
        ).map(({ sql, params, id, checked }) => ({ sql, params, conflictCheck: checked ? { id } : undefined }))
        : buildGroupedUpdateOperations(
            schema,
            updates as { entity: Record<string, unknown>; delta: Record<string, unknown> }[],
            getDialect('postgresql'),
            { suffix: ` RETURNING ${allColumnStr}` }
        ).map(({ sql, params }) => ({ sql, params }));

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
                entityWhereClauses.push(`"${idProperty.getResolvedName()}" = $${paramCounter++}`);
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
        // Root properties only, storage-side names — the layout the DDL creates. A column
        // per descendant would select phantom columns the table does not have.
        const columnProperties = sqlColumnProperties(schema);
        const columnCount = columnProperties.length;
        if (columnCount === 0) {
            throw new Error("Need to select at least one column, found zero");
        }

        columnsStr = `"${columnProperties[0].getResolvedName()}"`;
        for (let i = 1; i < columnCount; i++) {
            columnsStr += `, "${columnProperties[i].getResolvedName()}"`;
        }
    }

    const params: any[] = [];
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
            // Placeholders are numbered after the params already bound, so several filter
            // fragments can share one parameter list without renumbering.
            const { where, params: filterParams } = toSql(filterExpr, offsetPostgresDialect(params.length));
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
                // Wrap rather than rewrite the SELECT: a rewritten query keeps its
                // LIMIT/OFFSET, which then applies to the single count row (OFFSET
                // skips it entirely). Wrapping counts whatever the built query yields
                currentQuery = `SELECT COUNT(*) AS "count" FROM (${currentQuery}) AS count_subquery`;
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
