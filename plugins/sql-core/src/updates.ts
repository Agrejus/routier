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
 */

export type EntityUpdate = {
    entity: Record<string, unknown>;
    delta: Record<string, unknown>;
};

export type GroupedUpdateOperation = {
    sql: string;
    /** Parameters for this statement alone, numbered from the dialect's first placeholder. */
    params: unknown[];
    /** Id values of the rows this statement updates, in WHERE-clause order — for engines
     * without RETURNING, which must select the updated rows back by id. */
    ids: unknown[];
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
        });
    }

    return operations;
}
