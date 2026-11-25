import { isCallExpression, isComparatorExpression, isOperatorExpression, isValueExpression } from "../assertions";
import { CallExpression, ComparatorExpression, Expression, OperatorExpression, ValueExpression } from "./types";
import { getProperties } from "./utils";

export const REDACTED = "[redacted]";

export const touchesSensitive = (expression: Expression): boolean =>
    getProperties(expression).some(property => property.isSensitive);

function hideValues(expression: Expression): Expression;
function hideValues(expression: Expression | undefined): Expression | undefined;
function hideValues(expression: Expression | undefined): Expression | undefined {
    if (isValueExpression(expression)) {
        return new ValueExpression({ value: REDACTED });
    }

    if (isComparatorExpression(expression)) {
        return new ComparatorExpression({
            comparator: expression.comparator,
            negated: expression.negated,
            strict: expression.strict,
            left: hideValues(expression.left),
            right: hideValues(expression.right),
        });
    }

    if (isCallExpression(expression)) {
        return new CallExpression({
            call: expression.call,
            expression: hideValues(expression.expression),
            arguments: expression.arguments.map(argument => hideValues(argument)),
        });
    }

    return expression;
}

/** A copy of `expression` whose literals are `REDACTED` wherever they are compared with a sensitive property. */
export const redactExpression = (expression: Expression): Expression => {
    if (isOperatorExpression(expression)) {
        return new OperatorExpression({
            operator: expression.operator,
            left: redactSide(expression.left),
            right: redactSide(expression.right),
        });
    }

    return touchesSensitive(expression) ? hideValues(expression) : expression;
};

const redactSide = (side: Expression | undefined) => side == null ? side : redactExpression(side);
