import { isCallExpression, isComparatorExpression, isOperatorExpression, isPropertyExpression, isValueExpression } from "../assertions";
import { operandValue, UNRESOLVED } from "./evaluate";
import { Call, CallExpression, ComparatorExpression, Expression, OperatorExpression, ValueExpression } from "./types";
import { childrenOf } from "./utils";

/** Calls fold may compute. Absent means a plugin declines it, so a new call is opt-in. */
export const FOLDABLE: ReadonlySet<Call> = new Set([
    "to-lower-case", "to-upper-case", "length", "bit-not", "matches", "to-string", "concat",
    "add", "subtract", "multiply", "divide", "modulo", "power",
    "bit-and", "bit-or", "bit-xor", "shift-left", "shift-right", "shift-right-unsigned",
    "coalesce", "conditional",
]);

/** `String(value)` on an object is the host's rendering — a Date carries its timezone. */
const COERCES_TO_TEXT: ReadonlySet<Call> = new Set(["to-string", "concat"]);

const isFrozenPrimitive = (value: unknown): boolean => value == null || typeof value !== "object";

const readsAProperty = (expression: Expression): boolean => {
    if (isPropertyExpression(expression)) {
        return true;
    }

    return childrenOf(expression).some(readsAProperty);
};

/** A `conditional` holds a condition where every other call holds a value. */
const isConstant = (call: CallExpression): boolean => {
    if (!FOLDABLE.has(call.call) || !call.arguments.every(isValueExpression)) {
        return false;
    }

    if (COERCES_TO_TEXT.has(call.call)
        && [call.expression, ...call.arguments].some(operand =>
            isValueExpression(operand) && !isFrozenPrimitive(operand.value))) {
        return false;
    }

    return call.call === "conditional"
        ? !readsAProperty(call.expression)
        : isValueExpression(call.expression);
};

/** Computes every call whose operand and arguments are all literals. Runs after `bindExpression`. */
export const foldConstantCalls = (expression: Expression): Expression => {

    if (isCallExpression(expression)) {
        const folded = new CallExpression({
            call: expression.call,
            expression: foldConstantCalls(expression.expression),
            arguments: expression.arguments.map(foldConstantCalls)
        });

        if (!isConstant(folded)) {
            return folded;
        }

        const value = operandValue(folded, {});

        return value === UNRESOLVED ? folded : new ValueExpression({ value });
    }

    if (isComparatorExpression(expression)) {
        return new ComparatorExpression({
            comparator: expression.comparator,
            negated: expression.negated,
            strict: expression.strict,
            left: expression.left == null ? undefined : foldConstantCalls(expression.left),
            right: expression.right == null ? undefined : foldConstantCalls(expression.right)
        });
    }

    if (isOperatorExpression(expression)) {
        return new OperatorExpression({
            operator: expression.operator,
            left: expression.left == null ? undefined : foldConstantCalls(expression.left),
            right: expression.right == null ? undefined : foldConstantCalls(expression.right)
        });
    }

    return expression;
};

/** The value a literal operand binds as once the calls on it are computed. Throws if it cannot. */
export const foldedOperandValue = (operand: ValueExpression, calls: CallExpression[]): unknown => {
    if (calls.length === 0) {
        return operand.value;
    }

    // `peelCalls` returns calls innermost first, so the last one evaluates the whole chain.
    const outermost = calls[calls.length - 1];
    const value = readsAProperty(outermost) ? UNRESOLVED : operandValue(outermost, {});

    if (value === UNRESOLVED) {
        throw new Error(
            `'${calls.map(call => call.call).join("', '")}' cannot be computed on the literal ` +
            `'${String(operand.value)}'.`
        );
    }

    return value;
};
