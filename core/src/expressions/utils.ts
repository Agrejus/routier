import { PropertyInfo } from "../schema";
import { CallExpression, Expression, PropertyExpression } from "./types";

/**
 * An operand with the calls wrapping it, innermost first — the order they are applied in.
 *
 * The nodes rather than their names: a binary call carries arguments, and a consumer that only knows
 * the name renders `LOWER(col)` correctly and `col + ?` not at all.
 */
export type PeeledOperand = { operand: Expression, calls: CallExpression[] };

/**
 * Separates an operand from the calls applied to it.
 *
 * `null` when there is no operand beneath the calls. Every consumer needs this to decide whether a
 * comparator side is a property or a value, so it lives here rather than in each translator.
 */
export function peelCalls(expression: Expression | undefined): PeeledOperand | null {
    const calls: CallExpression[] = [];
    let current = expression;

    while (current != null && current.type === "call") {
        calls.push(current as CallExpression);
        current = (current as CallExpression).expression;
    }

    calls.reverse();

    return current == null ? null : { operand: current, calls };
}

export function childrenOf(expression: Expression): Expression[] {

    if (expression.type === "call") {
        const call = expression as CallExpression;

        const callChildren: Expression[] = [];

        if (call.expression != null) {
            callChildren.push(call.expression);
        }

        const args = call.arguments ?? [];

        for (let i = 0; i < args.length; i++) {
            const argument = args[i];

            if (argument != null) {
                callChildren.push(argument);
            }
        }

        return callChildren;
    }

    const children: Expression[] = [];

    if (expression.left != null) {
        children.push(expression.left);
    }

    if (expression.right != null) {
        children.push(expression.right);
    }

    return children;
}

/**
 * Extracts all properties referenced in an expression
 * @param expression The expression to analyze
 * @returns Array of PropertyInfo objects referenced in the expression
 */
export function getProperties(expression: Expression): PropertyInfo<any>[] {
    const properties: PropertyInfo<any>[] = [];

    function traverse(expr: Expression) {
        // If this is a property expression, add it to our collection
        if (expr.type === "property") {
            properties.push((expr as PropertyExpression).property);
        }

        const children = childrenOf(expr);

        for (let i = 0; i < children.length; i++) {
            traverse(children[i]);
        }
    }

    traverse(expression);
    return properties;
}

export function forEach(expression: Expression, callback: (expression: Expression) => boolean) {
    function traverse(expr: Expression): boolean {
        // Call the callback for this expression
        // If callback returns false, stop traversing
        if (!callback(expr)) {
            return false;
        }

        const children = childrenOf(expr);

        for (let i = 0; i < children.length; i++) {
            if (!traverse(children[i])) {
                return false;
            }
        }

        return true;
    }

    traverse(expression);
}