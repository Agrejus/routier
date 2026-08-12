/**
 * Dialect-aware SQL WHERE generation from expression trees.
 *
 * Uses a **Strategy** for SQL dialects (quoting, placeholders, LIKE vs GLOB).
 * Uses a **Visitor** over the expression AST. Equals comparison uses a Strategy
 * per (column-side, null vs value) case.
 */
import type { ComparatorExpression, Expression, PropertyExpression, Transformer } from "@routier/core/expressions";
import {
    isComparatorExpression,
    isOperatorExpression,
    isPropertyExpression,
    isValueExpression,
    SchemaTypes,
} from "@routier/core";

/** Supported SQL dialect names. */
export type SqlDialectName = "sqlite" | "postgresql" | "mysql" | "mssql";

/**
 * Dialect interface for generating portable SQL WHERE fragments.
 */
export interface SqlDialect {
    quoteIdentifier(name: string): string;
    getPlaceholder(paramIndex: number): string;
    stringMatchKind: "LIKE" | "GLOB";
    likeEscapeClause(): string;
    /**
     * Column type for a nested object or array held in a single column.
     *
     * Nested structures have no native column type in any SQL engine, so each one gets
     * stored as JSON in whatever form that engine offers. Core never sees this — it hands
     * plugins a partial entity and the plugin decides how a nested value becomes a column.
     */
    jsonColumnType: string;
    /**
     * Encodes a nested object or array for a `jsonColumnType` parameter.
     *
     * Every dialect stringifies today. It is a dialect method anyway because it is exactly
     * the kind of thing that diverges — `pg` can bind a JS object straight to `jsonb`, and
     * a driver that prefers that should be able to say so here rather than somewhere a
     * caller has to remember.
     */
    encodeJson(value: unknown): unknown;
    /**
     * Bindable form of a value for a `s.date()` property.
     *
     * Most engines accept an ISO-8601 string, which is what a serialized entity carries, so
     * the default is to pass it through. MySQL's DATETIME does not — it rejects both the `T`
     * separator and the `Z` suffix — so that dialect rewrites it.
     */
    encodeDate(value: unknown): unknown;
    /**
     * Bindable form of a value for a `s.boolean()` property.
     *
     * Most engines have a boolean type and take one directly. SQLite does not — it stores them
     * as INTEGER — and `node:sqlite` refuses to bind a JS boolean at all rather than coercing
     * it, so every save of an entity with a boolean failed with "provided value cannot be bound".
     * That is a fact about the engine, so it belongs on the dialect rather than on the caller,
     * who should not have to add a serializer for a type the schema already declares.
     */
    encodeBoolean(value: unknown): unknown;
    /**
     * SQL expression for the length of a column: character count for strings,
     * element count for arrays (which are stored as `jsonColumnType`).
     */
    lengthExpression(column: string, isJsonArray: boolean): string;
    /**
     * Reads a value out of a JSON column so a nested property can be filtered on.
     *
     * A nested subtree is stored as ONE JSON column named for its root (see
     * `sqlColumnProperties`), so `payload.inner.value` is not a column — it is a path into
     * the `payload` column. Without this the translator rendered the leaf name alone and
     * emitted `"value" = $1`, a column that does not exist.
     *
     * `leafType` is needed because every engine extracts JSON as text by default, and text
     * comparison answers `price > 9` with the wrong rows once a value reaches double digits.
     * Each dialect casts back to the type the schema declared.
     *
     * @param rootColumn Already quoted, as returned by `quoteIdentifier`.
     * @param path Storage-side segment names BELOW the root, leaf last.
     */
    jsonPathExpression(rootColumn: string, path: string[], leafType: SchemaTypes): string;
}

/** A path segment safe to write unquoted in a JSON path literal. */
const SIMPLE_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Escapes a value for use inside a single-quoted SQL string literal. */
const sqlStringLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/**
 * `$.a.b` form, used by SQLite, MySQL and SQL Server.
 *
 * A segment that is not a plain identifier is quoted, because `.from()` accepts any string
 * and an unquoted segment containing a dot would silently address a different level.
 */
const jsonPathLiteral = (path: string[]): string =>
    "$" + path
        .map(segment =>
            SIMPLE_SEGMENT.test(segment)
                ? `.${segment}`
                : `."${segment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        )
        .join("");

/** Engines that accept ISO-8601 directly. */
const passThroughDate = (value: unknown): unknown => value;

/** Engines with a real boolean type take one as it is. */
const passThroughBoolean = (value: unknown): unknown => value;

/** SQLite has no boolean type: 1 and 0, which is what its INTEGER column holds. */
const integerBoolean = (value: unknown): unknown => (value ? 1 : 0);

/** ISO-8601 with a `T` separator, which is what a serialized `s.date()` carries. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * `YYYY-MM-DD HH:MM:SS.mmm` in UTC — the only datetime literal MySQL accepts.
 *
 * MySQL rejects ISO-8601 outright ("Incorrect datetime value") because of the `T` separator
 * and the `Z` suffix, so every `s.date()` write failed against a real server. UTC rather than
 * local time, matching the `timezone: 'Z'` the plugin sets on its pool, so the value read
 * back is the value written.
 *
 * A value that is neither a Date nor an ISO string is left alone: the property may carry its
 * own `.serialize()` producing some other agreed format, and rewriting that would break a
 * schema that was working.
 */
const mysqlDate = (value: unknown): unknown => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? value : value.toISOString().replace('T', ' ').replace('Z', '');
    }

    if (typeof value === 'string' && ISO_DATE_TIME.test(value)) {
        return value.replace('T', ' ').replace(/Z$/, '');
    }

    return value;
};

const DIALECTS: Record<SqlDialectName, SqlDialect> = {
    sqlite: {
        quoteIdentifier(name) {
            return `"${name.replace(/"/g, '""')}"`;
        },
        getPlaceholder(_i) {
            return "?";
        },
        stringMatchKind: "GLOB",
        likeEscapeClause() {
            return "";
        },
        jsonColumnType: "JSON",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: passThroughDate,
        encodeBoolean: integerBoolean,
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `json_array_length(${column})` : `LENGTH(${column})`;
        },
        /**
         * `json_extract` is the one extractor that already returns a typed value — INTEGER,
         * REAL or TEXT as the document holds it — so SQLite needs no cast. JSON1 has been
         * built in since 3.38, and 3.45 added the JSONB storage format on top of the same
         * function names.
         */
        jsonPathExpression(rootColumn, path) {
            return `json_extract(${rootColumn}, ${sqlStringLiteral(jsonPathLiteral(path))})`;
        },
    },
    postgresql: {
        quoteIdentifier(name) {
            return `"${name.replace(/"/g, '""')}"`;
        },
        getPlaceholder(i) {
            return `$${i + 1}`;
        },
        stringMatchKind: "LIKE",
        likeEscapeClause() {
            return " ESCAPE E'\\\\'";
        },
        jsonColumnType: "JSONB",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: passThroughDate,
        encodeBoolean: passThroughBoolean,
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `jsonb_array_length(${column})` : `LENGTH(${column})`;
        },
        /**
         * `->` to navigate and `->>` for the final hop, which yields text. The cast back to
         * the declared type is what makes `count > 9` order numerically instead of
         * lexicographically — as text, `'10' < '9'`.
         */
        jsonPathExpression(rootColumn, path, leafType) {
            const segments = path.map(sqlStringLiteral);
            const leaf = segments[segments.length - 1];
            const parents = segments.slice(0, -1);
            const navigated = parents.length > 0 ? `${rootColumn}->${parents.join("->")}` : rootColumn;
            const text = `${navigated}->>${leaf}`;

            if (leafType === SchemaTypes.Number) {
                return `(${text})::numeric`;
            }

            if (leafType === SchemaTypes.Boolean) {
                return `(${text})::boolean`;
            }

            return text;
        },
    },
    mysql: {
        quoteIdentifier(name) {
            return "`" + name.replace(/`/g, "``") + "`";
        },
        getPlaceholder(_i) {
            return "?";
        },
        stringMatchKind: "LIKE",
        likeEscapeClause() {
            return " ESCAPE '\\\\'";
        },
        jsonColumnType: "JSON",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: mysqlDate,
        encodeBoolean: passThroughBoolean,
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `JSON_LENGTH(${column})` : `CHAR_LENGTH(${column})`;
        },
        /**
         * `JSON_EXTRACT` alone returns a JSON scalar, so a string comes back still wearing
         * its quotes and `= 'deep'` never matches. `JSON_UNQUOTE` strips them.
         *
         * Booleans then arrive as the text `'true'`/`'false'` while the driver binds a JS
         * boolean as 1/0, so the comparison is rewritten to produce 1/0 rather than cast.
         */
        jsonPathExpression(rootColumn, path, leafType) {
            const extracted = `JSON_UNQUOTE(JSON_EXTRACT(${rootColumn}, ${sqlStringLiteral(jsonPathLiteral(path))}))`;

            if (leafType === SchemaTypes.Number) {
                return `CAST(${extracted} AS DECIMAL(65,30))`;
            }

            if (leafType === SchemaTypes.Boolean) {
                return `(${extracted} = 'true')`;
            }

            return extracted;
        },
    },
    mssql: {
        quoteIdentifier(name) {
            return "[" + name.replace(/]/g, "]]") + "]";
        },
        getPlaceholder(i) {
            return `@p${i + 1}`;
        },
        stringMatchKind: "LIKE",
        likeEscapeClause() {
            return " ESCAPE '\\\\'";
        },
        jsonColumnType: "NVARCHAR(MAX)",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: passThroughDate,
        encodeBoolean: passThroughBoolean,
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `(SELECT COUNT(*) FROM OPENJSON(${column}))` : `LEN(${column})`;
        },
        /** `JSON_VALUE` returns nvarchar, so numbers and booleans both need rewriting. */
        jsonPathExpression(rootColumn, path, leafType) {
            const extracted = `JSON_VALUE(${rootColumn}, ${sqlStringLiteral(jsonPathLiteral(path))})`;

            if (leafType === SchemaTypes.Number) {
                return `CAST(${extracted} AS FLOAT)`;
            }

            if (leafType === SchemaTypes.Boolean) {
                return `CASE WHEN ${extracted} = 'true' THEN 1 ELSE 0 END`;
            }

            return extracted;
        },
    },
};

export function getDialect(name: SqlDialectName): SqlDialect {
    const d = DIALECTS[name];
    if (!d) throw new Error(`Unknown SQL dialect: ${name}`);
    return d;
}

function escapeLikeLiteral(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function escapeGlobLiteral(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/\?/g, "\\?");
}

function escapeForPattern(value: string, kind: "LIKE" | "GLOB"): string {
    return kind === "LIKE" ? escapeLikeLiteral(value) : escapeGlobLiteral(value);
}

function buildPattern(
    escapedValue: string,
    match: "contains" | "starts-with" | "ends-with",
    kind: "LIKE" | "GLOB"
): string {
    if (kind === "LIKE") {
        switch (match) {
            case "contains":
                return `%${escapedValue}%`;
            case "starts-with":
                return `${escapedValue}%`;
            case "ends-with":
                return `%${escapedValue}`;
        }
    }
    switch (match) {
        case "contains":
            return `*${escapedValue}*`;
        case "starts-with":
            return `${escapedValue}*`;
        case "ends-with":
            return `*${escapedValue}`;
    }
}

/**
 * Applies a parsed value transformer (e.g. `p.name.toLowerCase()`) to the value
 * before it is bound — SQL never sees value transformers, only their result.
 */
function applyValueTransformer(value: unknown, transformer: Transformer | null): unknown {
    if (transformer === "to-lower-case" && typeof value === "string") {
        return value.toLowerCase();
    }

    if (transformer === "to-upper-case" && typeof value === "string") {
        return value.toUpperCase();
    }

    return value;
}

/**
 * Renders a property reference as a column, wrapping it in the SQL function the
 * parsed transformer calls for (LOWER/UPPER/length). Ignoring the transformer
 * here would silently return wrong rows.
 */
/**
 * The column, or the JSON path into it when the property is nested.
 *
 * `getResolvedName()` returns the LEAF name, which is a real column only for a root
 * property. For `payload.inner.value` the storage is a `payload` JSON column and the rest
 * of the chain is a path inside it.
 */
/**
 * Qualifies a column identifier with a table alias, when there is one.
 *
 * Applied to the ROOT identifier only. A nested property is read out of a JSON column, so the
 * alias belongs on the column the JSON lives in — `"o"."nested" -> '$.inner'` — not on the path
 * inside it.
 */
const qualify = (identifier: string, alias: string | undefined, d: SqlDialect): string =>
    alias == null ? identifier : `${d.quoteIdentifier(alias)}.${identifier}`;

function renderColumnBase(prop: PropertyExpression, d: SqlDialect, alias?: string): string {
    const parents = prop.property.getParentPathArray({ useFromPropertyName: true });

    if (parents.length === 0) {
        return qualify(d.quoteIdentifier(prop.property.getResolvedName()), alias, d);
    }

    const [root, ...rest] = parents;

    return d.jsonPathExpression(
        qualify(d.quoteIdentifier(root), alias, d),
        [...rest, prop.property.getResolvedName()],
        prop.property.type
    );
}

function renderColumn(prop: PropertyExpression, d: SqlDialect, alias?: string): string {
    const col = renderColumnBase(prop, d, alias);

    if (prop.transformer === "to-lower-case") {
        return `LOWER(${col})`;
    }

    if (prop.transformer === "to-upper-case") {
        return `UPPER(${col})`;
    }

    if (prop.transformer === "length") {
        return d.lengthExpression(col, prop.property.type === SchemaTypes.Array);
    }

    return col;
}

/**
 * Result of splitting a comparator into left/right property and value sides.
 *
 * The absent-side sentinel is `undefined`, never `null`: `null` is a legitimate
 * operand (`entity.deletedAt == null`), so using it to mean "this side is not a
 * value expression" makes a real null indistinguishable from a property side.
 * That collision rendered `"x" == entity.prop` as `prop IS NULL`.
 */
interface PropertyValueSides {
    propLeft: PropertyExpression | null;
    propRight: PropertyExpression | null;
    valLeft: unknown;
    valRight: unknown;
}

function getPropertyValueSides(cmp: ComparatorExpression): PropertyValueSides {
    const propLeft = cmp.left && isPropertyExpression(cmp.left) ? cmp.left : null;
    const propRight = cmp.right && isPropertyExpression(cmp.right) ? cmp.right : null;
    const valLeft = cmp.left && isValueExpression(cmp.left) ? applyValueTransformer(cmp.left.value, cmp.left.transformer) : undefined;
    const valRight = cmp.right && isValueExpression(cmp.right) ? applyValueTransformer(cmp.right.value, cmp.right.transformer) : undefined;
    return { propLeft, propRight, valLeft, valRight };
}

// --- Equals: Strategy per (column-side, null vs value) case ---

type EqualsCase = "null-column-left" | "null-column-right" | "value-column-left" | "value-column-right";

interface EqualsRenderContext {
    col: string;
    value: unknown;
    negated: boolean;
    params: unknown[];
    placeholder: () => string;
}

function getEqualsCase(
    value: unknown,
    columnOnLeft: boolean,
    columnOnRight: boolean
): EqualsCase | null {
    if (value === null && columnOnLeft) return "null-column-left";
    if (value === null && columnOnRight) return "null-column-right";
    if (value !== null && columnOnLeft) return "value-column-left";
    if (value !== null && columnOnRight) return "value-column-right";
    return null;
}

function equalsNullColumnLeft(ctx: EqualsRenderContext): string {
    return ctx.negated ? `${ctx.col} IS NOT NULL` : `${ctx.col} IS NULL`;
}

/**
 * `null == entity.prop` — the operand order is reversed but the meaning is not.
 * A null test is not a binary comparison, so unlike the value cases there is no
 * mirrored form to emit: `? IS NULL` with a bound null is the tautology
 * `NULL IS NULL`, true for every row. This renders the column form, identical
 * to {@link equalsNullColumnLeft}, and binds no parameter.
 */
function equalsNullColumnRight(ctx: EqualsRenderContext): string {
    return ctx.negated ? `${ctx.col} IS NOT NULL` : `${ctx.col} IS NULL`;
}

function equalsValueColumnLeft(ctx: EqualsRenderContext): string {
    ctx.params.push(ctx.value);
    const ph = ctx.placeholder();
    return ctx.negated ? `${ctx.col} != ${ph}` : `${ctx.col} = ${ph}`;
}

function equalsValueColumnRight(ctx: EqualsRenderContext): string {
    ctx.params.push(ctx.value);
    const ph = ctx.placeholder();
    return ctx.negated ? `${ph} != ${ctx.col}` : `${ph} = ${ctx.col}`;
}

const EQUALS_STRATEGIES: Record<EqualsCase, (ctx: EqualsRenderContext) => string> = {
    "null-column-left": equalsNullColumnLeft,
    "null-column-right": equalsNullColumnRight,
    "value-column-left": equalsValueColumnLeft,
    "value-column-right": equalsValueColumnRight,
};

// --- String-pattern comparison (includes / starts-with / ends-with) ---

function renderStringPatternComparison(
    cmp: ComparatorExpression,
    d: SqlDialect,
    params: unknown[],
    placeholder: () => string,
    alias?: string
): string {
    const { propLeft, propRight, valLeft, valRight } = getPropertyValueSides(cmp);
    const kind = d.stringMatchKind;

    if (cmp.comparator === "includes") {
        const col =
            propLeft && valRight !== undefined
                ? renderColumn(propLeft, d, alias)
                : propRight && valLeft !== undefined
                  ? renderColumn(propRight, d, alias)
                  : null;
        const value = valRight !== undefined ? valRight : valLeft;

        // A null operand is rejected rather than stringified: `LIKE '%null%'` is
        // never what the caller meant.
        if (col === null || value == null) {
            throw new Error("Complex expressions not supported for includes operations");
        }

        if (Array.isArray(value)) {
            const placeholders = value.map(() => placeholder()).join(", ");
            params.push(...value.map(item => typeof item === "boolean" ? d.encodeBoolean(item) : item));
            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
        }

        const escaped = escapeForPattern(String(value), kind);
        const pattern = buildPattern(escaped, "contains", kind);
        params.push(pattern);
        const ph = placeholder();
        const op = kind === "GLOB" ? "GLOB" : "LIKE";
        const escape = kind === "LIKE" ? d.likeEscapeClause() : "";
        if (propLeft && valRight !== undefined) {
            return cmp.negated ? `${col} NOT ${op} ${ph}${escape}` : `${col} ${op} ${ph}${escape}`;
        }
        return cmp.negated ? `${ph} NOT ${op} ${col}${escape}` : `${ph} ${op} ${col}${escape}`;
    }

    const col =
        propLeft && valRight !== undefined
            ? renderColumn(propLeft, d, alias)
            : propRight && valLeft !== undefined
              ? renderColumn(propRight, d, alias)
              : null;
    const rawValue = valRight !== undefined ? valRight : valLeft;
    const value = rawValue == null ? null : String(rawValue);

    if (col === null || value === null) {
        throw new Error(`Complex expressions not supported for ${cmp.comparator} operations`);
    }

    const escaped = escapeForPattern(value, kind);
    const pattern = buildPattern(
        escaped,
        cmp.comparator === "starts-with" ? "starts-with" : "ends-with",
        kind
    );
    params.push(pattern);
    const ph = placeholder();
    const op = kind === "GLOB" ? "GLOB" : "LIKE";
    const escape = kind === "LIKE" ? d.likeEscapeClause() : "";

    if (propLeft && valRight !== undefined) {
        return cmp.negated ? `${col} NOT ${op} ${ph}${escape}` : `${col} ${op} ${ph}${escape}`;
    }
    return cmp.negated ? `${ph} NOT ${op} ${col}${escape}` : `${ph} ${op} ${col}${escape}`;
}

// --- Generic comparison ---

function renderGenericComparison(
    cmp: ComparatorExpression,
    walk: (e: Expression) => string
): string {
    const leftExpr = walk(cmp.left!);
    const rightExpr = walk(cmp.right!);
    switch (cmp.comparator) {
        case "equals":
            return cmp.negated ? `${leftExpr} != ${rightExpr}` : `${leftExpr} = ${rightExpr}`;
        case "greater-than":
            return cmp.negated ? `${leftExpr} <= ${rightExpr}` : `${leftExpr} > ${rightExpr}`;
        case "greater-than-equals":
            return cmp.negated ? `${leftExpr} < ${rightExpr}` : `${leftExpr} >= ${rightExpr}`;
        case "less-than":
            return cmp.negated ? `${leftExpr} >= ${rightExpr}` : `${leftExpr} < ${rightExpr}`;
        case "less-than-equals":
            return cmp.negated ? `${leftExpr} > ${rightExpr}` : `${leftExpr} <= ${rightExpr}`;
        default:
            throw new Error(`Unsupported comparator: ${cmp.comparator}`);
    }
}

export interface ToSqlResult {
    where: string;
    params: unknown[];
}

export type ToSqlOptions = {
    /**
     * Table alias to qualify every column with — `"o"."name"` rather than `"name"`.
     *
     * Needed only when the statement names more than one table, which today means a join. Any
     * column present on BOTH sides is otherwise ambiguous and the engine rejects the whole
     * statement; a discriminator column that every collection carries makes that the normal case
     * rather than an edge one.
     */
    alias?: string;
    /**
     * Where this clause's placeholders start counting.
     *
     * Irrelevant to a dialect with positional `?`, and load-bearing for one with numbered
     * placeholders: two clauses rendered separately and concatenated both start at `$1`, so the
     * second binds the first's values. The caller adding the clauses knows the running total.
     */
    paramOffset?: number;
};

/**
 * Converts an Expression to a SQL WHERE clause and bound parameters for the given dialect.
 */
export function toSql(
    expr: Expression,
    dialect: SqlDialectName | SqlDialect,
    options?: ToSqlOptions
): ToSqlResult {
    const d = typeof dialect === "string" ? getDialect(dialect) : dialect;
    const alias = options?.alias;

    /**
     * A value on its way to becoming a bound parameter.
     *
     * Only booleans need touching, and only because an engine may not have the type — SQLite
     * binds 1 and 0, everything else takes a boolean. Applied here rather than at each push
     * site so a filter cannot disagree with what `toColumnAssignments` wrote: comparing
     * `active = true` against a column holding 1 matches nothing, and returns an empty result
     * rather than an error.
     */
    const bindable = (value: unknown) => typeof value === "boolean" ? d.encodeBoolean(value) : value;
    const params: unknown[] = [];
    let paramIndex = options?.paramOffset ?? 0;

    function placeholder(): string {
        const p = d.getPlaceholder(paramIndex);
        paramIndex += 1;
        return p;
    }

    /** Visitor: map each expression node type to a SQL fragment. */
    function walk(e: Expression): string {
        if (isOperatorExpression(e)) {
            const left = e.left ? walk(e.left) : "";
            const right = e.right ? walk(e.right) : "";
            const sqlOp = e.operator === "&&" ? "AND" : e.operator === "||" ? "OR" : e.operator;
            return `(${left} ${sqlOp} ${right})`;
        }

        if (isComparatorExpression(e)) {
            const cmp = e;
            const isStringPattern =
                cmp.comparator === "starts-with" ||
                cmp.comparator === "ends-with" ||
                cmp.comparator === "includes";

            if (isStringPattern) {
                /* String pattern: includes / starts-with / ends-with → one renderer. */
                return renderStringPatternComparison(cmp, d, params, placeholder, alias);
            }

            if (cmp.comparator === "equals") {
                /* Equals: Strategy per (column-side, null vs value) case. */
                const { propLeft, propRight, valLeft, valRight } = getPropertyValueSides(cmp);
                const col =
                    propLeft && (valRight !== undefined || propRight)
                        ? renderColumn(propLeft, d, alias)
                        : propRight && (valLeft !== undefined || propLeft)
                          ? renderColumn(propRight, d, alias)
                          : null;
                const value = valRight !== undefined ? valRight : valLeft;
                const columnOnLeft = Boolean(propLeft && cmp.right && isValueExpression(cmp.right));
                const columnOnRight = Boolean(propRight && cmp.left && isValueExpression(cmp.left));

                if (col !== null && value !== undefined) {
                    const caseKey = getEqualsCase(value, columnOnLeft, columnOnRight);
                    if (caseKey !== null) {
                        const strategy = EQUALS_STRATEGIES[caseKey];
                        return strategy({
                            col,
                            // Encoded here rather than inside each strategy: they share one
                            // context and only some of them bind the value at all.
                            value: bindable(value),
                            negated: cmp.negated,
                            params,
                            placeholder,
                        });
                    }
                }
            }

            /* Generic: walk both sides and emit comparison operator. */
            return renderGenericComparison(cmp, walk);
        }

        if (isPropertyExpression(e)) {
            return renderColumn(e, d, alias);
        }

        if (isValueExpression(e)) {
            params.push(bindable(applyValueTransformer(e.value, e.transformer)));
            return placeholder();
        }

        throw new Error(`Unknown expression type: ${(e as Expression).type}`);
    }

    // A tautology (`x => true`) — no rows are excluded
    if (expr.type === "empty") {
        return { where: "1 = 1", params: [] };
    }

    const where = walk(expr);
    return { where, params };
}
