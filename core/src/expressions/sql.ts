/**
 * Dialect-aware SQL WHERE generation from expression trees.
 *
 * Uses a **Strategy** for SQL dialects (quoting, placeholders, LIKE vs GLOB).
 * Uses a **Visitor** over the expression AST. Equals comparison uses a Strategy
 * per (column-side, null vs value) case.
 */
import type { ComparatorExpression, Expression, PropertyExpression } from "./types";
import {
    isComparatorExpression,
    isOperatorExpression,
    isPropertyExpression,
    isValueExpression,
} from "../assertions";

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
}

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

/** Result of splitting a comparator into left/right property and value sides. */
interface PropertyValueSides {
    propLeft: PropertyExpression | null;
    propRight: PropertyExpression | null;
    valLeft: unknown;
    valRight: unknown;
}

function getPropertyValueSides(cmp: ComparatorExpression): PropertyValueSides {
    const propLeft = cmp.left && isPropertyExpression(cmp.left) ? cmp.left : null;
    const propRight = cmp.right && isPropertyExpression(cmp.right) ? cmp.right : null;
    const valLeft = cmp.left && isValueExpression(cmp.left) ? cmp.left.value : null;
    const valRight = cmp.right && isValueExpression(cmp.right) ? cmp.right.value : null;
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

function equalsNullColumnRight(ctx: EqualsRenderContext): string {
    ctx.params.push(null);
    const ph = ctx.placeholder();
    return ctx.negated ? `${ph} IS NOT NULL` : `${ph} IS NULL`;
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
    placeholder: () => string
): string {
    const { propLeft, propRight, valLeft, valRight } = getPropertyValueSides(cmp);
    const kind = d.stringMatchKind;

    if (cmp.comparator === "includes") {
        const col =
            propLeft && valRight !== null
                ? d.quoteIdentifier(propLeft.property.name)
                : propRight && valLeft !== null
                  ? d.quoteIdentifier(propRight.property.name)
                  : null;
        const value = valRight !== null ? valRight : valLeft;

        if (col === null) {
            throw new Error("Complex expressions not supported for includes operations");
        }

        if (Array.isArray(value)) {
            const placeholders = value.map(() => placeholder()).join(", ");
            params.push(...value);
            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
        }

        const escaped = escapeForPattern(String(value), kind);
        const pattern = buildPattern(escaped, "contains", kind);
        params.push(pattern);
        const ph = placeholder();
        const op = kind === "GLOB" ? "GLOB" : "LIKE";
        const escape = kind === "LIKE" ? d.likeEscapeClause() : "";
        if (propLeft && valRight !== null) {
            return cmp.negated ? `${col} NOT ${op} ${ph}${escape}` : `${col} ${op} ${ph}${escape}`;
        }
        return cmp.negated ? `${ph} NOT ${op} ${col}${escape}` : `${ph} ${op} ${col}${escape}`;
    }

    const col =
        propLeft && valRight !== null
            ? d.quoteIdentifier(propLeft.property.name)
            : propRight && valLeft !== null
              ? d.quoteIdentifier(propRight.property.name)
              : null;
    const value = valRight !== null ? String(valRight) : valLeft !== null ? String(valLeft) : null;

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

    if (propLeft && valRight !== null) {
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

/**
 * Converts an Expression to a SQL WHERE clause and bound parameters for the given dialect.
 */
export function toSql(
    expr: Expression,
    dialect: SqlDialectName | SqlDialect
): ToSqlResult {
    const d = typeof dialect === "string" ? getDialect(dialect) : dialect;
    const params: unknown[] = [];
    let paramIndex = 0;

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
                return renderStringPatternComparison(cmp, d, params, placeholder);
            }

            if (cmp.comparator === "equals") {
                /* Equals: Strategy per (column-side, null vs value) case. */
                const { propLeft, propRight, valLeft, valRight } = getPropertyValueSides(cmp);
                const col =
                    propLeft && (valRight !== undefined || propRight)
                        ? d.quoteIdentifier(propLeft.property.name)
                        : propRight && (valLeft !== undefined || propLeft)
                          ? d.quoteIdentifier(propRight.property.name)
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
                            value,
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
            return d.quoteIdentifier(e.property.name);
        }

        if (isValueExpression(e)) {
            params.push(e.value);
            return placeholder();
        }

        throw new Error(`Unknown expression type: ${(e as Expression).type}`);
    }

    const where = walk(expr);
    return { where, params };
}
