import { isCallExpression, isComparatorExpression, isOperatorExpression, isPropertyExpression, isValueExpression } from "../assertions";
import { UnknownRecord } from "../utilities";
import { Call, Comparator, Expression } from "./types";

/**
 * Runs a parsed expression against a row.
 *
 * The counterpart to `toSql` and `toMql`: those turn a tree into a backend's language, and this
 * turns it into an answer. Needed wherever a tree exists but the closure that produced it does
 * not — a filter split out of a larger predicate, an option rebuilt from a serialized query.
 *
 * ## It fails OPEN, and that is the whole safety argument
 *
 * `undefined` means "this tree cannot be evaluated here" — an unknown node, a transformer with no
 * implementation, a comparison between shapes that do not compare. Callers must read that as KEEP
 * THE ROW, never as exclude it.
 *
 * The reason is asymmetric cost. Every caller today uses this to NARROW something that a
 * subsequent, authoritative predicate will check again: a semi-join prefilter, a split conjunct.
 * Keeping a row this cannot judge costs one wasted comparison downstream. Dropping one loses data
 * from a query result and nothing anywhere reports it. So every uncertain path returns `undefined`,
 * and no path guesses `false`.
 *
 * ## Why not just reuse the caller's closure
 *
 * Because there often isn't one. A conjunct pulled out of `([p, m]) => p.a === 1 && m.b === 2` is
 * source TEXT; turning it back into a callable needs `new Function`, which a
 * Content-Security-Policy blocks — the same constraint that makes `softDeleteScope` build its tree
 * by hand. The tree is the only representation that survives.
 */
export type EvaluationResult = boolean | undefined;

/** Reads a property or literal operand, or `UNRESOLVED` when the node is not one. */
const UNRESOLVED = Symbol("unresolved");

const ARITHMETIC: Partial<Record<Call, (left: number, right: number) => number>> = {
    "add": (left, right) => left + right,
    "subtract": (left, right) => left - right,
    "multiply": (left, right) => left * right,
    "divide": (left, right) => left / right,
    "modulo": (left, right) => left % right,
    "power": (left, right) => left ** right,
    "bit-and": (left, right) => left & right,
    "bit-or": (left, right) => left | right,
    "bit-xor": (left, right) => left ^ right,
    "shift-left": (left, right) => left << right,
    "shift-right": (left, right) => left >> right,
    "shift-right-unsigned": (left, right) => left >>> right,
};

const applyCall = (call: Call, value: unknown, args: unknown[]): unknown | typeof UNRESOLVED => {
    // A call applied to an absent value has no answer, and inventing one ("" for a missing string)
    // is how a filter starts matching rows it should not.
    if (value == null) {
        return UNRESOLVED;
    }

    if (call === "to-lower-case") {
        return typeof value === "string" ? value.toLowerCase() : UNRESOLVED;
    }

    if (call === "to-upper-case") {
        return typeof value === "string" ? value.toUpperCase() : UNRESOLVED;
    }

    if (call === "length") {
        return typeof value === "string" || Array.isArray(value) ? value.length : UNRESOLVED;
    }

    if (call === "bit-not") {
        return typeof value === "number" ? ~value : UNRESOLVED;
    }

    if (call === "matches") {
        return typeof value === "string" && args[0] instanceof RegExp ? args[0].test(value) : UNRESOLVED;
    }

    if (call === "concat") {
        return args.every(argument => argument != null)
            ? [value, ...args].map(String).join("")
            : UNRESOLVED;
    }

    const arithmetic = ARITHMETIC[call];

    if (arithmetic != null) {
        return typeof value === "number" && typeof args[0] === "number"
            ? arithmetic(value, args[0])
            : UNRESOLVED;
    }

    return UNRESOLVED;
};

const operand = (expression: Expression | undefined, row: UnknownRecord): unknown | typeof UNRESOLVED => {
    if (expression == null) {
        return UNRESOLVED;
    }

    if (isValueExpression(expression)) {
        return expression.value;
    }

    if (isPropertyExpression(expression)) {
        // Through the PropertyInfo, so a nested path and a `from`-renamed segment resolve the same
        // way every other consumer of the tree resolves them.
        return expression.property.getValue(row);
    }

    if (isCallExpression(expression)) {

        /**
         * `??` and `? :` are the two calls whose whole job is to answer when something is absent, so
         * they run before the guard that refuses an absent operand.
         */
        if (expression.call === "coalesce") {
            const left = operand(expression.expression, row);

            return left === UNRESOLVED || left == null ? operand(expression.arguments[0], row) : left;
        }

        if (expression.call === "conditional") {
            const condition = evaluate(expression.expression, row);

            if (condition === undefined) {
                return UNRESOLVED;
            }

            return operand(expression.arguments[condition === true ? 0 : 1], row);
        }

        const inner = operand(expression.expression, row);

        if (inner === UNRESOLVED) {
            return UNRESOLVED;
        }

        const args: unknown[] = [];

        for (const argument of expression.arguments) {
            const resolved = operand(argument, row);

            if (resolved === UNRESOLVED) {
                return UNRESOLVED;
            }

            args.push(resolved);
        }

        return applyCall(expression.call, inner, args);
    }

    return UNRESOLVED;
};

/**
 * `a === b` for the comparators, with Dates compared by VALUE.
 *
 * A Date compares by reference under `===`, so two Dates holding the same instant would be
 * unequal — which is not what a filter on a date means, and not what any backend does.
 */
const equals = (left: unknown, right: unknown, strict: boolean): boolean => {
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() === right.getTime();
    }

    // oxlint-disable-next-line eqeqeq
    return strict ? left === right : left == right;
};

/** Ordered comparison, only for shapes that have an order. */
const compare = (left: unknown, right: unknown, comparator: Comparator): EvaluationResult => {
    const asComparable = (value: unknown) => value instanceof Date ? value.getTime() : value;

    const a = asComparable(left);
    const b = asComparable(right);

    const comparable = (typeof a === "number" && typeof b === "number")
        || (typeof a === "string" && typeof b === "string");

    if (comparable === false) {
        return undefined;
    }

    if (comparator === "greater-than") {
        return a > b;
    }

    if (comparator === "greater-than-equals") {
        return a >= b;
    }

    if (comparator === "less-than") {
        return a < b;
    }

    return a <= b;
};

const evaluateComparator = (comparator: Comparator, left: unknown, right: unknown, strict: boolean): EvaluationResult => {

    if (comparator === "equals") {
        return equals(left, right, strict);
    }

    if (comparator === "includes") {
        // Two shapes, and the tree does not distinguish them: `array.includes(value)` and
        // `string.includes(substring)`. Whichever side is the container decides.
        if (Array.isArray(left)) {
            return left.some(item => equals(item, right, strict));
        }

        if (Array.isArray(right)) {
            return right.some(item => equals(item, left, strict));
        }

        return typeof left === "string" && typeof right === "string" ? left.includes(right) : undefined;
    }

    if (comparator === "starts-with") {
        return typeof left === "string" && typeof right === "string" ? left.startsWith(right) : undefined;
    }

    if (comparator === "ends-with") {
        return typeof left === "string" && typeof right === "string" ? left.endsWith(right) : undefined;
    }

    return compare(left, right, comparator);
};

/**
 * Evaluates `expression` against `row`, or returns `undefined` when it cannot.
 *
 * See the note at the top of this file: `undefined` means KEEP the row.
 */
export const evaluate = (expression: Expression, row: UnknownRecord): EvaluationResult => {

    if (isOperatorExpression(expression)) {
        const left = expression.left == null ? undefined : evaluate(expression.left, row);
        const right = expression.right == null ? undefined : evaluate(expression.right, row);

        /**
         * One unevaluable side does not have to sink the whole tree.
         *
         * `a && b` where `a` is definitely false is false whatever `b` is, and `a || b` where `a`
         * is definitely true is true. That short-circuiting is what lets a mostly-understood
         * predicate still narrow anything at all — without it, one unfamiliar sub-expression makes
         * the entire filter a no-op.
         */
        if (expression.operator === "&&") {
            if (left === false || right === false) {
                return false;
            }

            return left === true && right === true ? true : undefined;
        }

        if (left === true || right === true) {
            return true;
        }

        return left === false && right === false ? false : undefined;
    }

    if (isComparatorExpression(expression)) {
        const left = operand(expression.left, row);
        const right = operand(expression.right, row);

        if (left === UNRESOLVED || right === UNRESOLVED) {
            return undefined;
        }

        const result = evaluateComparator(expression.comparator, left, right, expression.strict);

        if (result === undefined) {
            return undefined;
        }

        return expression.negated ? result === false : result;
    }

    // A tautology excludes nothing, which is exactly `true`. Anything else — a bare property, a
    // literal, `not-parsable` — is not a predicate this can judge.
    return expression.type === "empty" ? true : undefined;
};

/**
 * `evaluate`, as a predicate that keeps whatever it cannot judge.
 *
 * The form every narrowing caller wants, with the fail-open rule applied once here rather than
 * remembered at each call site.
 */
export const toPredicate = (expression: Expression) => (row: UnknownRecord): boolean =>
    evaluate(expression, row) !== false;

/**
 * `evaluate`, as a predicate that THROWS on anything it cannot judge.
 *
 * The opposite default to `toPredicate`, and the right one when the predicate is the only thing
 * standing between a caller and rows they asked to exclude — a filter that arrived over a wire and
 * is being applied by the receiver. Failing open there does not cost a wasted comparison; it returns
 * data the requester filtered out, and reports nothing.
 *
 * Use `toPredicate` when something authoritative re-checks the result, and this when nothing does.
 */
export const toStrictPredicate = (expression: Expression) => (row: UnknownRecord): boolean => {
    const result = evaluate(expression, row);

    if (result === undefined) {
        throw new Error(
            "Cannot apply this filter: its expression cannot be evaluated in memory, and applying it partially would " +
            "return rows the filter excludes.  This happens when a filter arrives without a runnable predicate — over a " +
            "wire, or rebuilt from a serialized query — and names something the evaluator does not understand."
        );
    }

    return result;
};
