import { PropertyInfo, CompiledSchema, SchemaTypes } from '@routier/core/schema';
import { Expression } from '@routier/core/expressions';
import { IQuery, JoinQueryOptionValue, Query } from '@routier/core/plugins';
import { SchemaPersistChanges } from '@routier/core/collections';
import { buildConditionalUpdateOperations, buildGroupedUpdateOperations, buildJoinStatement, getDialect, sqlColumnProperties, toColumnValueMap, toSql, reportUnrenderableFilters, executedMapFields } from '@routier/sql-plugin-core';
import { uuidv4 } from '@routier/core/utilities';
import { MysqlAddsOperation, MysqlRemovesOperation, MysqlSelectBack, MysqlUpdatesOperation, SqlOperation } from './types';

/**
 * Maps schema types to MySQL column types.
 *
 * Takes the property rather than its type alone because two mappings need more than the type:
 * a vector needs its width, and a string needs its declared length.
 */
const schemaTypeToMysqlType = (prop: PropertyInfo<any>): string => {
    switch (prop.type) {
        case SchemaTypes.String:
            // `VARCHAR(255)` unless the property declared otherwise. MySQL is the only engine
            // that needs the number: it truncates silently past the column width, and 255 is
            // short enough that a body of text hits it. Every other backend stores strings
            // unbounded and ignores the declaration.
            return `VARCHAR(${prop.maxLength ?? 255})`;
        case SchemaTypes.Number:
            // DOUBLE, not DECIMAL. mysql2 returns DECIMAL as a STRING to preserve exact
            // precision, so a `s.number()` property came back as "20.0000000000" and the
            // echoed row no longer matched the pending addition — every add failed in
            // `mergeChanges` with "Cannot find internal addition". DOUBLE arrives as a JS
            // number, which is what the schema type means. Identical reasoning to the
            // PostgreSQL NUMERIC → DOUBLE PRECISION change in known-defects #4.
            return 'DOUBLE';
        case SchemaTypes.Boolean:
            return 'BOOLEAN';
        case SchemaTypes.Date:
            // DATETIME(3), not DATETIME. The default precision is whole seconds, so MySQL
            // truncated the milliseconds a JS Date carries and the value read back was not the
            // value written. 3 is the most a JS Date can express (defect #70).
            return 'DATETIME(3)';
        case SchemaTypes.Object:
        case SchemaTypes.Array:
        // MySQL has no vector type before 9.0 and no similarity operator to go with one,
        // so a vector is stored as JSON and searched in memory.
        case SchemaTypes.Vector:
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
    return prop.type === SchemaTypes.Object || prop.type === SchemaTypes.Array || prop.type === SchemaTypes.Vector;
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
                colDef = `\`${prop.getResolvedName()}\` ${schemaTypeToMysqlType(prop)} PRIMARY KEY`;
            }
        } else if (isDeeplyNested(prop)) {
            colDef = `\`${prop.getResolvedName()}\` JSON`;
        } else {
            colDef = `\`${prop.getResolvedName()}\` ${schemaTypeToMysqlType(prop)}`;
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
                indexStatements.push(`UNIQUE KEY \`${idxName}\` (\`${prop.name}\`)`);
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
                indexStatements.push(`KEY \`${idxSqlName}\` (\`${props[0].name}\`)`);
                usedIndexNames.add(idxSqlName);
            }
        } else if (props.length > 1) {
            const idxSqlName = `${table}_${idxName}_clustered_idx`;
            const colList = props.map(p => `\`${p.name}\``).join(', ');
            if (!usedIndexNames.has(idxSqlName)) {
                indexStatements.push(`KEY \`${idxSqlName}\` (${colList})`);
                usedIndexNames.add(idxSqlName);
            }
        }
    }

    /**
     * Indexes are declared INSIDE the table rather than as separate CREATE INDEX statements.
     *
     * This used to emit `CREATE TABLE ...; CREATE INDEX ...;` as one string, and mysql2 runs
     * one statement per query unless `multipleStatements` is enabled — which is a SQL
     * injection surface nobody should turn on for this. So any schema declaring an index
     * failed to create its table at all, with a syntax error pointing at the second
     * statement. No test had an indexed property on MySQL, so nothing caught it.
     *
     * MySQL accepts `KEY` and `UNIQUE KEY` in the table body, which keeps the whole thing one
     * statement and idempotent under `IF NOT EXISTS`.
     */
    const indexClause = indexStatements.length === 0 ? '' : `,\n  ${indexStatements.join(',\n  ')}`;

    return `CREATE TABLE IF NOT EXISTS \`${table}\` (
  ${columns.join(',\n  ')}${pkClause}${indexClause}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
}

/**
 * Translates an Expression tree to a MySQL WHERE clause and parameters.
 *
 * Delegates to the shared builder, as the SQLite and PostgreSQL plugins already do. This
 * was a full hand-rolled copy of `toSql`, and every divergence between the two was a defect
 * rather than a MySQL requirement:
 *
 * - It rendered `prop.property.name`, ignoring `.from()` renames.
 * - It never escaped `%`, `_` or `\` in a LIKE literal, so searching for `50%` matched
 *   anything starting `50`.
 * - It had no JSON path handling, so a filter on a nested property emitted the leaf name
 *   and failed with `Unknown column`.
 *
 * The `mysql` dialect in `@routier/sql-plugin-core` already carries what is genuinely
 * MySQL-specific: backtick quoting, LIKE with its escape clause, `JSON_LENGTH`/`CHAR_LENGTH`,
 * the DATETIME literal rewrite, and `JSON_UNQUOTE(JSON_EXTRACT(...))` extraction.
 */
export function expressionToWhereClause(expr: Expression): { where: string, params: any[] } {
    return toSql(expr, 'mysql');
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
    // (multipleStatements is off). Each group carries its row keys for the select-back.
    //
    // Schemas with a `.concurrency()` token take one CONDITIONAL statement per row instead
    // of the grouped CASE form, so a stale write matches zero rows and is reported as a
    // conflict on that exact row. Same wiring as the PostgreSQL plugin; MySQL has no
    // RETURNING, so the conflict is detected from affectedRows rather than an empty result.
    const hasConcurrencyChecks = updates.some(u => (u as { concurrency?: unknown }).concurrency != null);
    const updatesOperations: MysqlUpdatesOperation[] = hasConcurrencyChecks
        ? buildConditionalUpdateOperations(
            schema,
            updates as { entity: Record<string, unknown>; delta: Record<string, unknown> }[],
            getDialect('mysql')
        ).map(({ sql, params, id, keyTuple, checked }) => ({
            sql,
            params,
            ids: [id],
            keyTuples: [keyTuple],
            conflictCheck: checked ? { id } : undefined,
        }))
        : buildGroupedUpdateOperations(
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

    reportUnrenderableFilters(options, "mysql");

    const mapFields = executedMapFields(options);

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
                // Wrap rather than rewrite the SELECT: a rewritten query keeps its
                // LIMIT/OFFSET, which then applies to the single count row — `OFFSET 1`
                // skips it entirely and the query returns no rows at all, so `countAsync()`
                // handed back `[]` instead of a number. Wrapping counts whatever the built
                // query yields. Same fix SQLite already carries.
                currentQuery = `SELECT COUNT(*) AS \`count\` FROM (${currentQuery}) AS count_subquery`;
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

/**
 * Restores the JS types MySQL's column types cannot carry, on rows coming back out.
 *
 * The plugin's DDL declares `BOOLEAN`, but that is a synonym for `TINYINT(1)` and mysql2
 * returns it as `0`/`1`. A round-tripped entity therefore had `inStock: 0` where the schema
 * says `boolean`, which fails an identity comparison against the pending addition and makes
 * `false` indistinguishable from `0` for anything downstream. Since the plugin knows the
 * declared type, honouring its own DDL is its job rather than the caller's.
 *
 * Only `s.boolean()` properties are touched, and only when the stored value really is 0 or 1
 * — a column written by something else, or already boolean, is left alone.
 */
export function decodeBooleanColumns<T extends {}>(rows: unknown, schema: CompiledSchema<T>): unknown {
    const booleanProperties = sqlColumnProperties(schema).filter(
        p => p.type === SchemaTypes.Boolean && p.valueDeserializer == null
    );

    if (booleanProperties.length === 0 || Array.isArray(rows) === false) {
        return rows;
    }

    for (const row of rows as Record<string, unknown>[]) {
        if (row == null || typeof row !== 'object') {
            continue;
        }

        for (const property of booleanProperties) {
            // Projection and aggregate rows are not entities; a column that is not there is
            // simply skipped.
            const column = property.getResolvedName();
            const value = row[column];

            if (value === 0 || value === 1) {
                row[column] = value === 1;
            }
        }
    }

    return rows;
}

/**
 * Builds the joined SELECT for a query carrying a `join` option.
 *
 * The emission is shared (`buildJoinStatement`); this supplies the inner schema, which lives in
 * the event's schema collection rather than in the query, and the outer side's own statement.
 *
 * The outer side is built by the ordinary single-table path and used as a derived table, because
 * MySQL applies `ORDER BY` and `LIMIT` to the JOINED rows: a `.take(2)` recorded before the join
 * has to window the outer rows, not the pairs, or it answers a different question from every other
 * backend.
 */
export function buildJoinQueryOperation<TEntity extends {}, TShape, TInner extends {}>(
    query: IQuery<TEntity, TShape>,
    innerSchema: CompiledSchema<TInner>
): SqlOperation & { join: JoinQueryOptionValue } {
    const { before, at } = query.options.splitAt("join");

    if (at == null) {
        throw new Error("buildJoinQueryOperation was called for a query with no join option.");
    }

    const outer = buildFromQueryOperation(new Query(before, query.schema));

    const joined = buildJoinStatement({
        dialect: getDialect('mysql'),
        join: at.value,
        outerSchema: query.schema,
        innerSchema,
        outer: outer.sql,
        outerParams: outer.params
    });

    return { ...joined, join: at.value };
}
