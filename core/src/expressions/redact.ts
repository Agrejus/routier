import { isCallExpression, isComparatorExpression, isOperatorExpression, isValueExpression } from "../assertions";
import { CallExpression, ComparatorExpression, Expression, OperatorExpression, ValueExpression } from "./types";
import { getProperties } from "./utils";

export const REDACTED = "[redacted]";

export const touchesSensitive = (expression: Expression): boolean =>
    getProperties(expression).some(property => property.isSensitive);

const hideValues = (expression: Expression): Expression => {
    if (isValueExpression(expression)) {
        return new ValueExpression({ value: REDACTED });
    }

    if (isComparatorExpression(expression)) {
        return new ComparatorExpression({
            comparator: expression.comparator,
            negated: expression.negated,
            strict: expression.strict,
            left: expression.left == null ? undefined : hideValues(expression.left),
            right: expression.right == null ? undefined : hideValues(expression.right),
        });
    }

    if (isCallExpression(expression)) {
        return new CallExpression({
            call: expression.call,
            expression: hideValues(expression.expression),
            arguments: expression.arguments.map(hideValues),
        });
    }

    return expression;
};

/** A copy of `expression` whose literals are `REDACTED` wherever they are compared with a sensitive property. */
export const redactExpression = (expression: Expression): Expression => {
    if (isOperatorExpression(expression)) {
        return new OperatorExpression({
            operator: expression.operator,
            left: expression.left == null ? undefined : redactExpression(expression.left),
            right: expression.right == null ? undefined : redactExpression(expression.right),
        });
    }

    return touchesSensitive(expression) ? hideValues(expression) : expression;
};
