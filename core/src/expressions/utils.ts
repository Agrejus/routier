import { PropertyInfo } from "../schema";
import { CallExpression, Expression, PropertyExpression } from "./types";

/**
 * A free function, not a method: `isExpression` is structural, so a plain object with a `type` is an
 * expression here and arrives that way off the wire.
 */
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