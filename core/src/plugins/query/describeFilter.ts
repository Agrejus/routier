import type { Comparator, Expression, NotParsableExpression, PropertyExpression } from "../../expressions";
import { renderCallAsJs } from "../../expressions/callSource";
import {
    isCallExpression,
    isComparatorExpression,
    isOperatorExpression,
    isPropertyExpression,
    isValueExpression,
} from "../../assertions";

/**
 * Saying what a backend was asked to do, with the values pulled out.
 *
 * `explain` already carries `{ text, parameters }` per executed query, and the SQL plugins fill
 * both in — a statement with `?` and the values bound to it. Every other backend reported a
 * placeholder: Dexie said `filter(<predicate>)`, which names nothing, and a key-value store said
 * only that it scanned. The predicate was the one thing a reader wanted and the one thing missing.
 *
 * Two renderings live here, and neither knows about a specific engine:
 *
 * - `describeFilterAsJs` — the predicate as JavaScript, for a backend with no query language of
 *   its own. It reads like what the caller wrote, which is what they are looking for.
 * - `parameteriseDocument` — for a backend whose query IS a document. Values become `?` and are
 *   collected in order, so a Mango selector and an MQL filter both come out in their own shape
 *   with the values listed beside them.
 *
 * Pulling values out is not decoration. It is what makes two runs of one query comparable, and
 * what keeps a value out of the text when that text is logged.
 */

export type ParameterisedQuery = {
    /** The query in its own language, with each value replaced by `?`. */
    text: string;
    /** The values, in the order their placeholders appear. */
    parameters: unknown[];
};

const COMPARATOR_OPERATORS: Partial<Record<Comparator, string>> = {
    "equals": "===",
    "greater-than": ">",
    "greater-than-equals": ">=",
    "less-than": "<",
    "less-than-equals": "<=",
};

/** The three comparators that read as a method call rather than an operator. */
const COMPARATOR_METHODS: Partial<Record<Comparator, string>> = {
    "starts-with": "startsWith",
    "includes": "includes",
    "ends-with": "endsWith",
};

const renderProperty = (property: PropertyExpression, row: string): string =>
    [row, ...property.property.getPathArray()].join(".");

/**
 * The predicate as JavaScript, with every value replaced by `?`.
 *
 * Rendered from the parsed tree rather than from the function's source. The tree is what the
 * backend was actually given, so this cannot drift from what ran; and a value reaching the tree
 * as a literal is indistinguishable from one arriving through a params object, which is what
 * makes both come out as `?` the way SQL treats them.
 */
export const describeFilterAsJs = (expression: Expression, row = "x"): ParameterisedQuery => {
    const parameters: unknown[] = [];

    const hold = (value: unknown): string => {
        parameters.push(value);

        return "?";
    };

    const side = (part: Expression | null | undefined): string => {
        if (part == null) {
            return "?";
        }

        if (isPropertyExpression(part)) {
            return renderProperty(part, row);
        }

        if (isValueExpression(part)) {
            return hold(part.value);
        }

        if (isCallExpression(part)) {
            return renderCallAsJs(part.call, () => side(part.expression), () => part.arguments.map(side));
        }

        return walk(part);
    };

    const walk = (current: Expression): string => {
        if (isOperatorExpression(current)) {
            const operator = current.operator === "&&" ? "&&" : "||";

            return `(${side(current.left)} ${operator} ${side(current.right)})`;
        }

        if (isComparatorExpression(current)) {
            const method = COMPARATOR_METHODS[current.comparator];

            // Evaluated LEFT then RIGHT, always: the parameter order has to match the reading
            // order of the text, or the values line up against the wrong placeholders.
            const left = side(current.left);
            const right = side(current.right);

            if (method != null) {
                const call = `${left}.${method}(${right})`;

                return current.negated ? `${call} === false` : call;
            }

            const symbol = COMPARATOR_OPERATORS[current.comparator];

            if (symbol == null) {
                return `${left} ${current.comparator} ${right}`;
            }

            return `${left} ${current.negated ? negate(symbol) : symbol} ${right}`;
        }

        if (isCallExpression(current)) {
            return renderCallAsJs(current.call, () => side(current.expression), () => current.arguments.map(side));
        }

        if (current.type === "empty") {
            return "(no filter)";
        }

        return current.type === "not-parsable" ? "(not parsable)" : `(unsupported: ${current.type})`;
    };

    return { text: walk(expression), parameters };
};

const negate = (symbol: string): string => {
    switch (symbol) {
        case "===": return "!==";
        case ">": return "<=";
        case ">=": return "<";
        case "<": return ">=";
        case "<=": return ">";
        default: return `!${symbol}`;
    }
};

/**
 * Marks a value inside a query document so it is replaced by `?` rather than printed.
 *
 * A document language carries its values inline, so there is nothing in the shape itself to say
 * which parts are operators and which are data. A dialect wraps the data as it builds the
 * document, and `parameteriseDocument` reads the wrapper.
 */
const PARAMETER = Symbol("routier.parameter");

export type ParameterHolder = { readonly [PARAMETER]: unknown };

export const parameter = (value: unknown): ParameterHolder => ({ [PARAMETER]: value });

const isParameter = (value: unknown): value is ParameterHolder =>
    typeof value === "object" && value !== null && PARAMETER in value;

/**
 * Renders a query DOCUMENT with its values replaced by `?`.
 *
 * Language-agnostic on purpose: an MQL filter and a Mango selector are both plain objects, and so
 * is whatever a future document store wants reported. The dialect decides the shape; this only
 * decides how it is written down.
 *
 * A value not wrapped by `parameter` is structural — an operator name, a field path, a nesting
 * level — and is printed as it is. That is the whole distinction, and it has to be made where the
 * document is built, because by the time it is an object the two are the same kind of thing.
 */
export const parameteriseDocument = (document: unknown): ParameterisedQuery => {
    const parameters: unknown[] = [];

    const render = (value: unknown): string => {
        if (isParameter(value)) {
            parameters.push((value as Record<symbol, unknown>)[PARAMETER]);

            return "?";
        }

        if (Array.isArray(value)) {
            return `[${value.map(render).join(", ")}]`;
        }

        if (typeof value === "object" && value !== null) {
            const entries = Object.entries(value as Record<string, unknown>)
                .map(([key, nested]) => `${JSON.stringify(key)}: ${render(nested)}`);

            return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
        }

        return JSON.stringify(value) ?? String(value);
    };

    return { text: render(document), parameters };
};

export type DescribedFilters = ParameterisedQuery & {
    /** Why a filter is not shown as an expression, one entry per filter that could not be parsed. */
    notes: string[];
};

/**
 * Every filter on a query, as the body of one JavaScript predicate over `row`.
 *
 * Filters accumulate, so `.where(a).where(b)` is `a && b`. Parameters run left to right across
 * the whole body, matching the text. A filter that could not be parsed is written as a call of
 * the caller's own function on `row`, and the reason goes in `notes`.
 */
export const describeFilters = (
    filters: readonly { expression: Expression; filter?: unknown }[],
    row = "x"
): DescribedFilters => {
    const parameters: unknown[] = [];
    const notes: string[] = [];

    const parts = filters.map(entry => {
        if (entry.expression?.type === "not-parsable") {
            const described = describeUnparsableFilter(entry.filter, row, (entry.expression as NotParsableExpression).reason);

            notes.push(described.note);

            return described.text;
        }

        const described = describeFilterAsJs(entry.expression, row);

        parameters.push(...described.parameters);

        return described.text;
    });

    return { text: parts.join(" && "), parameters, notes };
};

/** A predicate core could not parse, written as a call of the caller's function on `row`. */
export const describeUnparsableFilter = (filter: unknown, row = "x", reason?: string): { text: string; note: string } => ({
    text: typeof filter === "function" ? `(${String(filter)})(${row})` : "true",
    note: `a filter could not be parsed (${reason ?? "unsupported syntax"}), so it ran as JavaScript`,
});
