import { CompiledSchema } from '@routier/core/schema';
import type { SqlDialect } from './sql';
import { toColumnValueMap } from './columns';

/**
 * The grouped-UPDATE builder shared by the SQL plugins.
 *
 * Entities in one save rarely change the same columns, so updates are grouped by their
 * changed-column set and each group becomes one statement:
 *
 *   UPDATE "t" SET "col" = CASE "id" WHEN ? THEN ? ... ELSE "col" END, ... WHERE "id" IN (...)
 *
 * One statement PER GROUP, never joined with ';': PostgreSQL's extended query protocol and
 * mysql2's default configuration both permit exactly one command per parameterized
 * statement, and SQLite's driver only tolerates the join by accident. This used to be
 * duplicated verbatim in the sqlite, postgresql, and mysql plugins — with the join bug in
 * all three (defect #22) — so it lives here now, and the dialect supplies quoting and
 * placeholders.
 *
 * The CASE form needs one column to switch on, so it applies only to single-key schemas.
 * Composite keys take the per-row branch instead: one UPDATE each, with every identity
 * column in the WHERE. Both branches return the same operation shape, so callers do not
 * distinguish them.
 */

export type EntityUpdate = {
    entity: Record<string, unknown>;
    delta: Record<string, unknown>;
    /** Present when the row carries an optimistic-concurrency token — see EntityUpdateInfo. */
    concurrency?: { column: string; expected: number };
};

/**
 * The full identity of one row: every identity column mapped to its value.
 *
 * Every WHERE this module emits is built from all of these, never just the first.
 * A predicate on one component of a composite key matches every row that shares
 * that component, so a partial-key UPDATE does not merely miss its target — it
 * overwrites its siblings.
 */
export type KeyTuple = Record<string, unknown>;

function keyTupleOf<T extends {}>(schema: CompiledSchema<T>, entity: Record<string, unknown>): KeyTuple {
    const tuple: KeyTuple = {};
    for (const property of schema.idProperties) {
        tuple[property.getResolvedName()] = property.getValue(entity as any);
    }
    return tuple;
}

/**
 * `"a" = ? AND "b" = ?` over every identity column, appending the values to `params`.
 */
function keyPredicate(tuple: KeyTuple, dialect: SqlDialect, params: unknown[], placeholder: () => string): string {
    const clauses: string[] = [];
    for (const [column, value] of Object.entries(tuple)) {
        clauses.push(`${dialect.quoteIdentifier(column)} = ${placeholder()}`);
        params.push(value);
    }
    return clauses.join(' AND ');
}

/**
 * What a conflict report calls this row. Single-key schemas keep the bare id value
 * they have always reported; composite keys join their components, because
 * `OptimisticConcurrencyError` stringifies what it is given and an object would
 * arrive as `[object Object]`.
 */
function conflictIdOf(tuple: KeyTuple): unknown {
    const values = Object.values(tuple);
    return values.length === 1 ? values[0] : values.map(String).join('|');
}

/**
 * One conditional UPDATE per row, for schemas with a `.concurrency()` token.
 *
 * Token-checked rows cannot ride the grouped CASE statement: each row's WHERE carries its
 * own `AND token = expected`, and the caller must be able to tell WHICH row a zero-row
 * result belongs to. `id` identifies the row so an empty result (or RETURNING set) can be
 * reported as a conflict on that row. Rows without a token (they predate it — the write
 * initializes it) get the same per-row statement without the token clause.
 */
export type ConditionalUpdateOperation = {
    sql: string;
    params: unknown[];
    /** How a conflict on this row is reported — see {@link conflictIdOf}. */
    id: unknown;
    /** The row's full identity, for callers that need to re-select it. */
    keyTuple: KeyTuple;
    /** True when the statement carries a token check — a zero-row result is a CONFLICT. */
    checked: boolean;
};

export function buildConditionalUpdateOperations<T extends {}>(
    schema: CompiledSchema<T>,
    updates: readonly EntityUpdate[],
    dialect: SqlDialect,
    options?: { suffix?: string }
): ConditionalUpdateOperation[] {
    if (updates.length === 0) {
        return [];
    }

    const table = dialect.quoteIdentifier(schema.collectionName);
    const identityNames = schema.idProperties.map(p => p.getResolvedName());
    const suffix = options?.suffix ?? '';

    const operations: ConditionalUpdateOperation[] = [];

    for (const update of updates) {
        let resolved = toColumnValueMap(update.delta, schema, dialect, update.entity);

        if (resolved.size === 0) {
            const wholeEntity = Object.fromEntries(
                Object.keys(update.entity)
                    .filter(key => identityNames.includes(key) === false)
                    .map(key => [key, update.entity[key]])
            );
            resolved = toColumnValueMap(wholeEntity, schema, dialect);
        }

        const params: unknown[] = [];
        let paramIndex = 0;
        const placeholder = () => dialect.getPlaceholder(paramIndex++);

        const setClauses: string[] = [];
        for (const [column, value] of resolved) {
            setClauses.push(`${dialect.quoteIdentifier(column)} = ${placeholder()}`);
            params.push(value);
        }

        const tuple = keyTupleOf(schema, update.entity);
        let where = keyPredicate(tuple, dialect, params, placeholder);

        if (update.concurrency != null) {
            where += ` AND ${dialect.quoteIdentifier(update.concurrency.column)} = ${placeholder()}`;
            params.push(update.concurrency.expected);
        }

        operations.push({
            sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${where}${suffix}`,
            params,
            id: conflictIdOf(tuple),
            keyTuple: tuple,
            checked: update.concurrency != null,
        });
    }

    return operations;
}

export type GroupedUpdateOperation = {
    sql: string;
    /** Parameters for this statement alone, numbered from the dialect's first placeholder. */
    params: unknown[];
    /** Id values of the rows this statement updates, in WHERE-clause order — for engines
     * without RETURNING, which must select the updated rows back by id. Only meaningful
     * for single-key schemas; composite-key callers must use {@link keyTuples}. */
    ids: unknown[];
    /** Full identity of each updated row, in WHERE-clause order. Correct for both single
     * and composite keys, so select-back should prefer it over {@link ids}. */
    keyTuples: KeyTuple[];
};

export function buildGroupedUpdateOperations<T extends {}>(
    schema: CompiledSchema<T>,
    updates: readonly EntityUpdate[],
    dialect: SqlDialect,
    options?: {
        /** Appended verbatim to each statement, e.g. ` RETURNING "a", "b"`. Omit for
         * engines without RETURNING. */
        suffix?: string;
    }
): GroupedUpdateOperation[] {
    if (updates.length === 0) {
        return [];
    }

    const table = dialect.quoteIdentifier(schema.collectionName);
    const identityNames = schema.idProperties.map(p => p.getResolvedName());
    const isComposite = schema.idProperties.length > 1;
    const idProperty = schema.idProperties[0];
    const idColumn = dialect.quoteIdentifier(idProperty.getResolvedName());
    const suffix = options?.suffix ?? '';

    // The delta is a partial ENTITY (core's EntityDelta) and has to be resolved to columns
    // before it can be grouped or bound: renames become storage-side names, and nested
    // objects/arrays become JSON. Core does not know what a column is by design.

    /** Column -> already-encoded parameter value, per update. */
    const columnValues = new Map<EntityUpdate, Map<string, unknown>>();

    for (const update of updates) {
        let resolved = toColumnValueMap(update.delta, schema, dialect, update.entity);

        // An empty delta means "no tracked change list", not "nothing changed" — fall back
        // to every non-identity property, through the same resolution so nested values are
        // still encoded.
        if (resolved.size === 0) {
            const wholeEntity = Object.fromEntries(
                Object.keys(update.entity)
                    .filter(key => identityNames.includes(key) === false)
                    .map(key => [key, update.entity[key]])
            );
            resolved = toColumnValueMap(wholeEntity, schema, dialect);
        }

        columnValues.set(update, resolved);
    }

    // Group updates by which columns they're changing
    const updateGroups = new Map<string, EntityUpdate[]>();

    for (const update of updates) {
        const deltaKeys = [...columnValues.get(update)!.keys()].sort().join(',');
        if (!updateGroups.has(deltaKeys)) {
            updateGroups.set(deltaKeys, []);
        }
        updateGroups.get(deltaKeys)!.push(update);
    }

    const operations: GroupedUpdateOperation[] = [];

    for (const [, groupUpdates] of updateGroups) {
        // Already resolved to columns above, empty-delta fallback included.
        const deltaKeys = [...columnValues.get(groupUpdates[0])!.keys()];

        if (isComposite) {
            // A composite key has no single column to switch on, and `CASE "a" WHEN ?`
            // over one component would apply that row's value to every row sharing it.
            // Row-value syntax (`("a","b") IN ((?,?),...)`) would work on Postgres and
            // MySQL but not SQLite, so instead each row becomes its own statement with a
            // full-key WHERE — the same one-statement-per-operation shape the grouped path
            // already returns, so no caller has to change.
            for (const update of groupUpdates) {
                const params: unknown[] = [];
                let paramIndex = 0;
                const placeholder = () => dialect.getPlaceholder(paramIndex++);

                const setClauses: string[] = [];
                for (const key of deltaKeys) {
                    setClauses.push(`${dialect.quoteIdentifier(key)} = ${placeholder()}`);
                    params.push(columnValues.get(update)!.get(key));
                }

                const tuple = keyTupleOf(schema, update.entity);
                const where = keyPredicate(tuple, dialect, params, placeholder);

                operations.push({
                    sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${where}${suffix}`,
                    params,
                    ids: [conflictIdOf(tuple)],
                    keyTuples: [tuple],
                });
            }

            continue;
        }

        const setClauses: string[] = [];
        const params: unknown[] = [];
        const ids = groupUpdates.map(update => idProperty.getValue(update.entity as any));
        let paramIndex = 0;
        const placeholder = () => dialect.getPlaceholder(paramIndex++);

        for (const key of deltaKeys) {
            let caseStatement = `${dialect.quoteIdentifier(key)} = CASE ${idColumn}`;

            for (let i = 0; i < groupUpdates.length; i++) {
                caseStatement += ` WHEN ${placeholder()} THEN ${placeholder()}`;
                params.push(ids[i]);
                params.push(columnValues.get(groupUpdates[i])!.get(key));
            }

            caseStatement += ` ELSE ${dialect.quoteIdentifier(key)} END`;
            setClauses.push(caseStatement);
        }

        const idPlaceholders = groupUpdates.map(() => placeholder()).join(', ');
        params.push(...ids);

        operations.push({
            sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${idColumn} IN (${idPlaceholders})${suffix}`,
            params,
            ids,
            keyTuples: groupUpdates.map(update => keyTupleOf(schema, update.entity)),
        });
    }

    return operations;
}
