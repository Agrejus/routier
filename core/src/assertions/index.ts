import { EXPRESSION_TYPES } from "../expressions/constants";
import { ComparatorExpression, EmptyExpression, Expression, ExpressionType, NotParsableExpression, OperatorExpression, PropertyExpression, ValueExpression } from "../expressions/types";
import { isDate } from "../utilities";

export function assertDate(data: unknown): asserts data is Date {
    if (isDate(data) === false) {
        throw new TypeError('Value is not a Date');
    }
}

export function assertIsNotNull<T>(data: T | null | undefined, message?: string | (() => string)): asserts data is NonNullable<T> {
    if (data == null) {
        if (message == null) {
            throw new TypeError('Assertion failed, data is null');
        }

        if (typeof message === "string") {
            throw new TypeError(message);
        }

        throw new TypeError(message());
    }
}

export function assertIsArray<T>(data: unknown, message?: string): asserts data is T[] {
    if (!Array.isArray(data)) {
        throw new TypeError(message ?? 'Assertion failed, data is not of type Array');
    }
}

export function assertString(data: unknown, message?: string): asserts data is string {
    if (typeof data !== "string") {
        throw new TypeError(message ?? 'Assertion failed, data is not of type String');
    }
}

export function assertInstanceOf<T extends new (...args: any[]) => any>(value: unknown, Instance: T): asserts value is T {
    if (value instanceof Instance) {
        return;
    }

    if (value != null && typeof value === "object" && "constructor" in value) {
        throw new TypeError(`value is not instance of type.  Type: ${value.constructor.name}`);
    }

    throw new TypeError(`value is not instance of type`);
}

export function assertIsNumber(value: unknown): asserts value is number {
    if (typeof value !== "number") {
        throw new TypeError("value is not of type `number`");
    }
}


function isObjectWithType(value: unknown): value is Record<"type", unknown> {
    return typeof value === "object" && value !== null && "type" in value;
}

/**
 * Type guard: narrows `value` to `Expression` when it is an object with a valid `type` property.
 */
export function isExpression(value: unknown): value is Expression {
    return isObjectWithType(value) && EXPRESSION_TYPES.includes(value.type as ExpressionType);
}

/**
 * Type guard: narrows `value` to `OperatorExpression` when it is an object with `type === "operator"`.
 */
export function isOperatorExpression(value: unknown): value is OperatorExpression {
    return isObjectWithType(value) && value.type === "operator";
}

/**
 * Type guard: narrows `value` to `ComparatorExpression` when it is an object with `type === "comparator"`.
 */
export function isComparatorExpression(value: unknown): value is ComparatorExpression {
    return isObjectWithType(value) && value.type === "comparator";
}

/**
 * Type guard: narrows `value` to `PropertyExpression` when it is an object with `type === "property"`.
 */
export function isPropertyExpression(value: unknown): value is PropertyExpression {
    return isObjectWithType(value) && value.type === "property";
}

/**
 * Type guard: narrows `value` to `ValueExpression` when it is an object with `type === "value"`.
 */
export function isValueExpression(value: unknown): value is ValueExpression {
    return isObjectWithType(value) && value.type === "value";
}

/**
 * Type guard: narrows `value` to `EmptyExpression` when it is an object with `type === "empty"`.
 */
export function isEmptyExpression(value: unknown): value is EmptyExpression {
    return isObjectWithType(value) && value.type === "empty";
}

/**
 * Type guard: narrows `value` to `NotParsableExpression` when it is an object with `type === "not-parsable"`.
 */
export function isNotParsableExpression(value: unknown): value is NotParsableExpression {
    return isObjectWithType(value) && value.type === "not-parsable";
}