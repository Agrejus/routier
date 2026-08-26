import { PropertyInfo } from "../schema";
import { Call, CallExpression, Expression, PropertyExpression } from "./types";

/** An operand with the calls wrapping it, innermost first — the order they are applied in. */
export type PeeledOperand = { operand: Expression, calls: Call[] };

/**
 * Separates an operand from the calls applied to it.
 *
 * `null` when there is no operand beneath the calls. Every consumer needs this to decide whether a
 * comparator side is a property or a value, so it lives here rather than in each translator.
 */
export function peelCalls(expression: Expression | undefined): PeeledOperand | null {
    const calls: Call[] = [];
    let current = expression;

    while (current != null && current.type === "call") {
        calls.unshift((current as CallExpression).call);
        current = (current as CallExpression).expression;
    }

    return current == null ? null : { operand: current, calls };
}

export function childrenOf(expression: Expression): Expression[] {

    if (expression.type === "call") {
        const call = expression as CallExpression;

        return [call.expression, ...(call.arguments ?? [])].filter(child => child != null);
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

        for (const child of childrenOf(expr)) {
            traverse(child);
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

        for (const child of childrenOf(expr)) {
            if (!traverse(child)) {
                return false;
            }
        }

        return true;
    }

    traverse(expression);
}