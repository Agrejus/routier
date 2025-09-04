import { PropertyInfo } from "../schema";
import { Expression, PropertyExpression } from "./types";

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

        // Traverse left and right expressions if they exist
        if (expr.left) {
            traverse(expr.left);
        }
        if (expr.right) {
            traverse(expr.right);
        }
    }

    traverse(expression);
    return properties;
}

export function isPropertyExpression(expression: Expression): expression is PropertyExpression {
    return expression.type === "property";
}

export function forEach(expression: Expression, callback: (expression: Expression) => boolean) {
    function traverse(expr: Expression): boolean {
        // Call the callback for this expression
        // If callback returns false, stop traversing
        if (!callback(expr)) {
            return false;
        }

        // Traverse left and right expressions if they exist
        if (expr.left) {
            if (!traverse(expr.left)) {
                return false;
            }
        }
        if (expr.right) {
            if (!traverse(expr.right)) {
                return false;
            }
        }

        return true;
    }

    traverse(expression);
}