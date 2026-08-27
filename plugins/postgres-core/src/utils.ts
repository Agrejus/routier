import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression } from '@routier/core/expressions';
import { IQuery, JoinQueryOptionValue, Query, QueryField } from '@routier/core/plugins';
import { SchemaPersistChanges } from '@routier/core/collections';
import { buildConditionalUpdateOperations, buildGroupedUpdateOperations, buildJoinStatement, entityResultColumns, getDialect, sqlColumnProperties, toColumnValueMap, toSql, canRenderInSql, SqlDialect } from '@routier/sql-plugin-core';
import { mappedResultColumns, ResultColumn } from '@routier/core/plugins';
import { SqlOperation } from './types';

/**
 * What this connection can do with a vector, decided once by probing for pgvector.
 *
 * Passed rather than detected here because DDL generation is synchronous and the answer is a
 * fact about the server. The SAME value must reach the DDL and the query builder: a table
 * created as `JSONB` with a `<=>` ordering run against it is a type error at query time, and
 * the reverse silently reads a native vector column as JSON.
 */
export type PostgresVectorSupport = {
    /** True when the `vector` extension is installed and a `vector(n)` column is usable. */
    readonly available: boolean;
};

/** What to assume before a probe has run: nothing. Storing JSON always works. */
export const NO_VECTOR_SUPPORT: PostgresVectorSupport = { available: false };

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
            // TIMESTAMPTZ, not TIMESTAMP. A naive column has no offset, so the driver renders
            // the value one way on the way in and reads it back as local time on the way out:
            // every date returned shifted by the client's UTC offset. That was silent for a
            // schema with an explicit key, and surfaced only with an identity key, where the
            // correlation hash could no longer match the echoed row (defect #70).
            return 'TIMESTAMPTZ';
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
 * Determines if a property is stored as a JSON column.
 *
 * A vector is one of these ONLY when pgvector is missing. With the extension installed it
 * gets a real `vector(n)` column, which is what makes the `<=>` ordering available; without
 * it the numbers go into JSONB and the search runs in memory instead.
 */
const isDeeplyNested = (prop: PropertyInfo<any>, vectors: PostgresVectorSupport): boolean => {
    return prop.type === SchemaTypes.Object
        || prop.type === SchemaTypes.Array
        || (prop.type === SchemaTypes.Vector && vectors.available === false);
};

/**
 * The column type for a vector property on a server that has pgvector.
 *
 * The width is required — pgvector's `vector` accepts an unspecified dimension, but a column
 * declared that way cannot be indexed and gives up the engine's own width check, which is the
 * earliest place a mismatched embedding can be caught.
 */
const vectorColumnType = (prop: PropertyInfo<any>): string => {
    if (prop.dimensions == null) {
        throw new Error(`A vector property reached the PostgreSQL DDL with no dimension count.  Property: ${prop.name}`);
    }

    return `vector(${prop.dimensions})`;
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
export function compiledSchemaToPostgresTable(schema: CompiledSchema<any>, tableName?: string, vectors: PostgresVectorSupport = NO_VECTOR_SUPPORT): string {
    const columns: string[] = [];
    const idProps = schema.idProperties;
    const table = tableName || schema.collectionName;

    // The one key that gets SERIAL/UUID treatment. Shared with the join key cast so the two
    // cannot disagree about which columns are `uuid` — see singleIdentityKeyProperty.
    const singleIdentityPK: PropertyInfo<any> | undefined = singleIdentityKeyProperty(schema) ?? undefined;

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
        } else if (isDeeplyNested(prop, vectors)) {
            colDef = `"${prop.getResolvedName()}" JSONB`;
        } else if (prop.type === SchemaTypes.Vector) {
            colDef = `"${prop.getResolvedName()}" ${vectorColumnType(prop)}`;
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
                if (isDeeplyNested(prop, vectors)) {
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
 * The one identity key that gets special column treatment, or `null`.
 *
 * A schema with a single identity id property maps it to `SERIAL` (number) or `UUID` (string);
 * anything else — a composite key, a caller-supplied key — is an ordinary column. Extracted so the
 * DDL and `postgresJoinKeyCast` cannot disagree about which columns are `uuid`, which they would
 * eventually do if each restated the rule.
 */
export const singleIdentityKeyProperty = <T extends {}>(schema: CompiledSchema<T>): PropertyInfo<T> | null => {
    const idProperties = schema.idProperties;
    const identityProperties = idProperties.filter(p => p.isIdentity);

    if (identityProperties.length !== 1 || idProperties.length !== 1) {
        return null;
    }

    return identityProperties[0];
};

/** Whether this property's column is declared `UUID` — a single STRING identity key, and only that. */
export const isUuidColumn = <T extends {}>(schema: CompiledSchema<T>, property: PropertyInfo<any> | null): boolean => {
    if (property == null) {
        return false;
    }

    const identity = singleIdentityKeyProperty(schema);

    return identity != null && identity.name === property.name && identity.type === SchemaTypes.String;
};

/**
 * Which side of a join has to be cast, and to what.
 *
 * PostgreSQL has no implicit `uuid = text`, and the everyday join shape crosses exactly that
 * boundary: a string identity key is a `uuid` column, and the foreign key pointing at it is an
 * ordinary `text` one. The uuid side is the one cast, never the text side — see `keyCast` in
 * `buildJoinStatement` for why casting text to uuid is not an option.
 *
 * Nothing is cast when both columns are the same type, so an int-to-int or text-to-text join keeps
 * its indexes.
 */
export const postgresJoinKeyCast = <TOuter extends {}, TInner extends {}>(
    outerSchema: CompiledSchema<TOuter>,
    innerSchema: CompiledSchema<TInner>,
    join: JoinQueryOptionValue
): { outer?: string; inner?: string } => {
    const outerIsUuid = isUuidColumn(outerSchema, join.outerKey.property);
    const innerIsUuid = isUuidColumn(innerSchema, join.innerKey.property);

    if (outerIsUuid === innerIsUuid) {
        return {};
    }

    return outerIsUuid ? { outer: 'text' } : { inner: 'text' };
};

/**
 * Builds a complete SQL query from an IQuery object for PostgreSQL.
 */
/**
 * Statement shapes that REPLACE the select list, so the projected columns stop describing what
 * comes back. Reporting them would be a false description.
 */
const REWRITES_SELECT_LIST = new Set(['count', 'min', 'max', 'sum']);

const describedResult = (
    operations: readonly { type: string }[],
    columns: readonly ResultColumn[]
): readonly ResultColumn[] | undefined =>
    operations.some(operation => REWRITES_SELECT_LIST.has(operation.type)) ? undefined : columns;

export function buildFromQueryOperation<TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>, vectors: PostgresVectorSupport = NO_VECTOR_SUPPORT): SqlOperation & { nearestPushedDown: boolean } {
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

    /**
     * ONE ordered list, from which both the select list and the result description come.
     *
     * Deriving them separately is how a description comes to disagree with the statement it
     * describes, and the wrong order does not fail — a consumer encoding columnar would file every
     * column's values under another column's name.
     *
     * Root properties only when there is no projection: storage-side names, the layout the DDL
     * creates. A column per descendant would select phantom columns the table does not have.
     */
    const resultColumns = mapFields != null && mapFields.length > 0
        ? mappedResultColumns(mapFields)
        : entityResultColumns(schema);

    if (resultColumns.length === 0) {
        throw new Error("Need to select at least one column, found zero");
    }

    let columnsStr = `"${resultColumns[0].name}"`;
    for (let i = 1; i < resultColumns.length; i++) {
        columnsStr += `, "${resultColumns[i].name}"`;
    }

    const params: any[] = [];
    let currentQuery = `SELECT ${columnsStr} FROM "${tableName}"`;

    /**
     * Ask before translating: an option this engine cannot express is handed back, and the datastore
     * runs it over the rows this query does return.
     */
    for (const item of options.get("filter")) {
        const expression = (item.option.value as { expression?: Expression }).expression;

        if (expression != null && canRenderInSql(expression, "postgresql") === false) {
            options.reportMissingCapability(item);
        }
    }

    const operations: Array<{ type: string, value: any, index: number }> = [];
    let totalOps = 0;
    for (const [, items] of options.items) {
        totalOps += items.length;
    }
    operations.length = totalOps;

    let opIndex = 0;
    for (const [, items] of options.items) {
        for (const item of items) {
            if (item.option.target === "database" && item.option.reason !== "executed") {
                continue;
            }

            operations[opIndex++] = {
                type: item.option.name,
                value: item.option.value,
                index: item.index
            };
        }
    }


    // Pre-sized above, so skipping an option leaves an undefined hole the reader would trip on
    operations.length = opIndex;

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

    // A similarity search is pushed down only when nothing else here competes for the
    // ORDER BY and LIMIT it needs.
    //
    // A window is the disqualifying case. `.take(5).nearest(v, 10)` means "five rows, then
    // the ten nearest among them", and one statement cannot say that — a single LIMIT applies
    // to the whole query, so pushing both down answers a different question. Leaving the
    // search to the translator answers the right one over the five rows SQL returned.
    //
    // A preceding sort is not disqualifying, it is simply overwritten: the search reorders
    // everything, exactly as the in-memory path does.
    const nearestOp = otherOps.find(op => op.type === 'nearest');
    const nearestPushedDown = vectors.available && nearestOp != null && skipTakeOps.length === 0;

    if (nearestPushedDown) {
        const { property, propertyName, vector, count } = nearestOp!.value;
        const column = property?.getResolvedName() ?? propertyName;

        // The same text `JSON.stringify` produces for a JSON column, which is also pgvector's
        // input literal — one encoding serves both storage shapes.
        params.push(JSON.stringify(vector));

        // `<=>` is cosine distance. No index is declared for it on purpose: pgvector's HNSW
        // and IVFFlat are APPROXIMATE, so an indexed search can return a different set of
        // rows than the exact scoring every other backend performs — and returning the same
        // rows everywhere is the promise this feature makes. An exact ordering still avoids
        // shipping every row to the client and scoring it in JS, which is the bulk of the win.
        currentQuery += ` ORDER BY "${column}" <=> $${params.length} LIMIT ${count}`;
    } else {
        // Build ORDER BY
        for (const op of sortOps) {
            const sortProp = op.value.propertyName;
            const sortDir = op.value.direction === 'asc' ? 'ASC' : 'DESC';
            currentQuery += ` ORDER BY "${sortProp}" ${sortDir}`;
        }
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

    return { sql: currentQuery, params, nearestPushedDown, result: describedResult(otherOps, resultColumns) };
}

/**
 * Builds the joined SELECT for a query carrying a `join` option.
 *
 * The emission itself is shared (`buildJoinStatement`); this supplies the two things only the
 * plugin knows — the inner schema, which lives in the event's schema collection, and the outer
 * side's own statement.
 *
 * The outer side is built by the ordinary single-table path and used as a derived table, because
 * PostgreSQL applies `ORDER BY` and `LIMIT` to the JOINED rows: a `.take(2)` recorded before the
 * join has to window the outer rows, not the pairs, or it answers a different question from every
 * other backend. Its parameters are bound first, and the inner side's scope placeholders continue
 * the `$n` numbering from there.
 */
export function buildJoinQueryOperation<TEntity extends {}, TShape, TInner extends {}>(
    query: IQuery<TEntity, TShape>,
    innerSchema: CompiledSchema<TInner>,
    vectors: PostgresVectorSupport = NO_VECTOR_SUPPORT
): SqlOperation & { join: JoinQueryOptionValue } {
    const { before, at } = query.options.splitAt("join");

    if (at == null) {
        throw new Error("buildJoinQueryOperation was called for a query with no join option.");
    }

    const outer = buildFromQueryOperation(new Query(before, query.schema), vectors);

    const { columns, ...joined } = buildJoinStatement({
        dialect: getDialect('postgresql'),
        join: at.value,
        outerSchema: query.schema,
        innerSchema,
        outer: outer.sql,
        outerParams: outer.params,
        keyCast: postgresJoinKeyCast(query.schema, innerSchema, at.value)
    });

    // The FLAT joined row, aliased per side. A driver that decodes it does so before
    // `splitJoinRows` cuts it in two.
    return { ...joined, result: columns, join: at.value };
}
