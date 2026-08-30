import { Call, CompiledSchema, JoinKind, JoinQueryOptionValue, JoinTuple, toEntityShape, UnknownRecord } from "@routier/core";
import { holdsAnyCall } from "./capability";
import { decodeJsonColumns, sqlColumnProperties } from "./columns";
import { SqlDialect, SqlDialectName, canRenderInSql, toSql } from "./sql";
import { ResultColumn } from "@routier/core/plugins";

/**
 * Native `JOIN` emission, shared by every SQL plugin.
 *
 * This is "interpretation 1" from `specs/joins.md`: the engine pairs the rows. What it must NOT
 * change is the answer — the tuples produced here are byte-identical to the ones the in-memory
 * hash join produces on the same data, which is what `describeJoinContract` asserts.
 *
 * Two problems make a join more than a longer SELECT string, and both are solved here once
 * rather than per plugin:
 *
 * 1. **Column collisions.** One flat row carries both sides, so `name` from either table lands in
 *    the same slot. Every column is aliased per side (`o__name`, `i__name`) and every filter is
 *    qualified by table alias — a discriminator column that all collections carry makes an
 *    ambiguous reference the normal case, not an edge one.
 * 2. **Splitting the row back apart.** The wire contract is TUPLES with each half deserialized
 *    into its own schema's entity shape, so a flat row has to be cut in two, each half decoded
 *    and deserialized against a different schema, and reassembled.
 *
 * What is deliberately NOT here: the outer side's own SELECT. A `sort`, `skip` or `take` recorded
 * BEFORE a join applies to the outer ROWS, and SQL applies `ORDER BY`/`LIMIT` to the joined
 * result — so pushing them into the join statement would window the pairs instead and answer a
 * different question. The caller builds the outer side with its ordinary single-table builder and
 * hands it over as a subquery, which reproduces exactly the in-memory ordering: window the outer
 * rows, then pair them.
 */

/** Alias for the outer side, and the prefix its columns are projected under. */
export const JOIN_OUTER_ALIAS = "o";
/** Alias for the inner side, and the prefix its columns are projected under. */
export const JOIN_INNER_ALIAS = "i";

const OUTER_PREFIX = `${JOIN_OUTER_ALIAS}__`;
const INNER_PREFIX = `${JOIN_INNER_ALIAS}__`;

export type SqlJoinStatement = {
    sql: string;
    params: unknown[];
    /**
     * The flat columns the projection emits, in order, aliased per side.
     *
     * Returned rather than re-derived by the caller: a transfer plan that disagrees with the
     * select list files every column under another column's name, and the only way to make that
     * impossible is for one place to produce both.
     */
    columns: ResultColumn[];
};

/**
 * Builds the whole joined SELECT around an already-built outer statement.
 *
 * @param outer The outer side's ordinary single-table SELECT, with ALL its root columns projected
 * and its own filters/sort/window already applied. Used as a derived table.
 * @param outerParams That statement's bound parameters, in order. The inner side's scope
 * parameters are appended after them, and its placeholders are numbered from there — a dialect
 * with `$n` placeholders binds the wrong values otherwise.
 */
export const buildJoinStatement = <TOuter extends {}, TInner extends {}>(options: {
    dialect: SqlDialect;
    join: JoinQueryOptionValue;
    outerSchema: CompiledSchema<TOuter>;
    innerSchema: CompiledSchema<TInner>;
    outer: string;
    outerParams: readonly unknown[];
    /**
     * A SQL type to cast a key column to before comparing, per side.
     *
     * Needed when the two key columns have different SQL types even though the schema declares
     * the same one. PostgreSQL is the case: a single string identity key is a `uuid` column while
     * a plain string foreign key is `text`, and it refuses `uuid = text` outright. A typeless
     * engine like SQLite never needs this.
     *
     * Which side to cast is not a free choice. Casting the TEXT side to `uuid` would preserve the
     * primary key index, but it throws for the whole query the moment one row holds a value that
     * is not a uuid — and a foreign key pointing at a row that no longer exists is exactly the
     * case a `leftJoin` is for. Casting the uuid side to text always succeeds.
     */
    keyCast?: { outer?: string; inner?: string };
}): SqlJoinStatement => {
    const { dialect, join, outerSchema, innerSchema, outer, outerParams, keyCast } = options;

    const quote = (name: string) => dialect.quoteIdentifier(name);
    const outerAlias = quote(JOIN_OUTER_ALIAS);
    const innerAlias = quote(JOIN_INNER_ALIAS);

    const project = (schema: CompiledSchema<any>, alias: string, prefix: string) =>
        sqlColumnProperties(schema)
            .map(property => {
                const column = property.getResolvedName();

                return {
                    sql: `${alias}.${quote(column)} AS ${quote(`${prefix}${column}`)}`,
                    column: { name: `${prefix}${column}`, property } satisfies ResultColumn,
                };
            });

    const projected = [
        ...project(outerSchema, outerAlias, OUTER_PREFIX),
        ...project(innerSchema, innerAlias, INNER_PREFIX),
    ];

    const projection = projected.map(entry => entry.sql).join(", ");

    const outerKeyColumn = join.outerKey.property?.getResolvedName() ?? join.outerKey.propertyName;
    const innerKeyColumn = join.innerKey.property?.getResolvedName() ?? join.innerKey.propertyName;

    const joinType = join.kind === "left" ? "LEFT JOIN" : "INNER JOIN";

    const keyExpression = (alias: string, column: string, cast: string | undefined) =>
        cast == null ? `${alias}.${quote(column)}` : `CAST(${alias}.${quote(column)} AS ${cast})`;

    const params = [...outerParams];
    const conditions: string[] = [
        `${keyExpression(outerAlias, outerKeyColumn, keyCast?.outer)} = ${keyExpression(innerAlias, innerKeyColumn, keyCast?.inner)}`
    ];

    /**
     * The inner side's own filters — its soft-delete scope and any `.scope()`.
     *
     * The correctness trap of the whole feature: a join bypasses the inner collection's read path,
     * so these exist ONLY because the option carries them, and an emitter that drops them returns
     * soft-deleted rows with no error anywhere.
     *
     * **They go in the `ON` clause, never in a `WHERE`.** A `WHERE` is applied AFTER the join, so
     * on a `LEFT JOIN` an unmatched row — whose inner columns are all `NULL` — fails any condition
     * on the inner table and is discarded. The left join then behaves exactly like an inner one,
     * which is the difference between "this player has no matches" and "this player does not
     * exist". In the `ON` clause the condition instead decides what COUNTS as a match, which is
     * what an inner-side scope means. For an `INNER JOIN` the two placements are equivalent, so
     * one rule covers both.
     *
     * Only the DATABASE half is emitted — a filter core marked memory-only has no column to
     * compare against. `canPushDownJoin` is what stops a plugin claiming the pushdown in that case.
     */
    for (const { option } of join.innerOptions.split().database.get("filter")) {
        const expression = option.value.expression;

        if (expression == null) {
            continue;
        }

        const rendered = toSql(expression, dialect, { alias: JOIN_INNER_ALIAS, paramOffset: params.length });

        conditions.push(rendered.where);
        params.push(...rendered.params);
    }

    return {
        sql: `SELECT ${projection} FROM (${outer}) AS ${outerAlias} ${joinType} ${quote(innerSchema.collectionName)} AS ${innerAlias} ON ${conditions.join(" AND ")}`,
        params,
        columns: projected.map(entry => entry.column)
    };
};

/**
 * Whether every filter of the inner side can be expressed in SQL, by this dialect.
 *
 * A plugin must ask this BEFORE claiming a join was pushed down. Two ways the answer is no:
 *
 *  - core marked an inner filter memory-only — an unmapped or a renamed property — so there is no
 *    column to compare and the statement would silently return rows the scope excludes;
 *  - the filter holds a call this ENGINE cannot render. The main read path asks `canRenderInSql`
 *    before translating, and without the same question here a join was the one way to reach a
 *    renderer for a call the dialect does not claim.
 *
 * `dialect` is optional so an existing caller keeps its meaning; passing it is what closes the
 * second hole.
 */
export const canPushDownJoin = (
    join: JoinQueryOptionValue,
    dialect?: SqlDialectName | SqlDialect,
    divergentCalls: readonly Call[] = []
): boolean => {

    if (join.innerOptions.split().memory.get("filter").length > 0) {
        return false;
    }

    if (dialect == null) {
        return true;
    }

    for (const { option } of join.innerOptions.split().database.get("filter")) {
        const expression = option.value.expression;

        if (expression == null) {
            continue;
        }

        // An inner filter goes into the ON clause, where nothing can report it afterwards.
        if (canRenderInSql(expression, dialect) === false || holdsAnyCall(expression, divergentCalls)) {
            return false;
        }
    }

    return true;
};

/**
 * Cuts flat joined rows back into tuples, each half deserialized against its own schema.
 *
 * The inner half of an unmatched `LEFT JOIN` row is `undefined`, and the test for that is the
 * inner KEY column being `NULL` — never "all its columns are null". A matched row whose other
 * columns happen to be null is a real row and must come back as an entity; the key cannot be
 * null on a row that matched, because a null key matches nothing.
 */
export const splitJoinRows = <TOuter extends {}, TInner extends {}>(options: {
    rows: readonly UnknownRecord[];
    kind: JoinKind;
    join: JoinQueryOptionValue;
    outerSchema: CompiledSchema<TOuter>;
    innerSchema: CompiledSchema<TInner>;
}): JoinTuple[] => {
    const { rows, kind, join, outerSchema, innerSchema } = options;

    const innerKeyColumn = join.innerKey.property?.getResolvedName() ?? join.innerKey.propertyName;

    const outerColumns = sqlColumnProperties(outerSchema).map(property => property.getResolvedName());
    const innerColumns = sqlColumnProperties(innerSchema).map(property => property.getResolvedName());

    const outerRows: UnknownRecord[] = [];
    const innerRows: UnknownRecord[] = [];
    // Which slot of `innerRows` each pair uses, or -1 for an unmatched left row. Kept separate
    // so the two sides can be decoded as whole arrays rather than row by row.
    const innerSlots: number[] = [];

    for (const row of rows) {
        const matched = kind !== "left" || row[`${INNER_PREFIX}${innerKeyColumn}`] != null;

        const outerHalf: UnknownRecord = {};
        for (const column of outerColumns) {
            outerHalf[column] = row[`${OUTER_PREFIX}${column}`];
        }
        outerRows.push(outerHalf);

        if (matched === false) {
            innerSlots.push(-1);
            continue;
        }

        const innerHalf: UnknownRecord = {};
        for (const column of innerColumns) {
            innerHalf[column] = row[`${INNER_PREFIX}${column}`];
        }

        innerSlots.push(innerRows.length);
        innerRows.push(innerHalf);
    }

    // Each side against its OWN schema: JSON columns and booleans decode differently per schema,
    // and the outer query's deserialization only ever knew about the outer one.
    decodeJsonColumns(outerRows, outerSchema);
    decodeJsonColumns(innerRows, innerSchema);

    const outerEntities = toEntityShape(outerSchema, outerRows);
    const innerEntities = toEntityShape(innerSchema, innerRows);

    return outerEntities.map((outerEntity, index): JoinTuple => {
        const slot = innerSlots[index];

        return [outerEntity, slot === -1 ? undefined : innerEntities[slot]];
    });
};
