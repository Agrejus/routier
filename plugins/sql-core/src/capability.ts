import { Call, CallExpression, Expression, forEach, isCallExpression, logger, QueryField, QueryOption, QueryOptionsCollection } from "@routier/core";
import { canRenderInSql, SqlDialectName } from "./sql";

/** Hands back every filter this dialect cannot render, for the datastore to run in memory. */
export const reportUnrenderableFilters = (
    options: QueryOptionsCollection<any>,
    dialect: SqlDialectName
): void => {
    for (const item of options.get("filter")) {
        const expression = (item.option.value as { expression?: Expression }).expression;

        if (expression != null && canRenderInSql(expression, dialect) === false) {
            options.reportMissingCapability(item);
        }
    }
};

/** The columns a `map` narrows the select list to, or `null` to select the entity. */
export const executedMapFields = (options: QueryOptionsCollection<any>): QueryField[] | null => {
    for (const [, items] of options.items) {
        for (const item of items) {
            const option = item.option;

            if (option.name === "map"
                && option.target === "database"
                && option.reason === "executed"
                && option.value.fields) {
                return option.value.fields;
            }
        }
    }

    return null;
};

/** The join to push down, or `null`. Reports first: a JOIN over an unfiltered outer side pairs the wrong rows. */
export const joinToPushDown = (
    options: QueryOptionsCollection<any>,
    dialect: SqlDialectName
): QueryOption<any, "join"> | null => {
    reportUnrenderableFilters(options, dialect);

    const join = options.getLast("join");

    return join != null && join.reason === "executed" ? join : null;
};

export const holdsAnyCall = (expression: Expression, calls: readonly Call[]): boolean => {
    let found = false;

    forEach(expression, node => {
        if (isCallExpression(node) && calls.includes((node as CallExpression).call)) {
            found = true;

            return false;
        }

        return true;
    });

    return found;
};

/** Hands back every filter this engine would answer differently from JavaScript, and warns. */
export const reportDivergentCalls = (
    options: QueryOptionsCollection<any>,
    calls: readonly Call[],
    warning: string
): void => {
    for (const item of options.get("filter")) {
        const expression = (item.option.value as { expression?: Expression }).expression;

        if (expression != null && holdsAnyCall(expression, calls)) {
            logger.warn(warning);
            options.reportEngineDivergence(item);
        }
    }
};

export const CASING_CALLS: readonly Call[] = ["to-lower-case", "to-upper-case"];

/** SQLite's `lower()` folds ASCII only, so `lower('É')` is `'É'` where JavaScript gives `'é'`. */
export const casingWarning = (engine: string): string =>
    `Routier: ${engine} cannot be given JavaScript's toLowerCase, so a filter using it runs in ` +
    `memory instead of the database. The rows are correct; the query reads more of the table than ` +
    `it needs to. https://routier.dev/guides/sqlite-case-folding`;
