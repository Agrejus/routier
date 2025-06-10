import { Expression, PropertyPathExpression } from "./types";
import { PropertyInfo } from "../common/PropertyInfo";

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
            properties.push((expr as PropertyPathExpression).property);
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