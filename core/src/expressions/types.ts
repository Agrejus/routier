import { PropertyInfo } from "@core/schema";

/**
 * The base class for all expression types.
 */
export abstract class Expression {
    /** The type of the expression. */
    abstract readonly type: ExpressionType;
    /** The left-hand side of the expression (if applicable). */
    left?: Expression;
    /** The right-hand side of the expression (if applicable). */
    right?: Expression;

    constructor(left?: Expression, right?: Expression) {
        this.left = left;
        this.right = right;
    }

    static get EMPTY() {
        return new EmptyExpression();
    }

    static get NOT_PARSABLE() {
        return new NotParsableExpression();
    }

    static isEmpty(expression: Expression) {
        return expression.type === "empty" || expression instanceof EmptyExpression;
    }

    static isNotParsable(expression: Expression) {
        return expression.type === "not-parsable" || expression instanceof NotParsableExpression;
    }
}

export class EmptyExpression extends Expression {
    readonly type = "empty" as const;
}

export class NotParsableExpression extends Expression {
    readonly type = "not-parsable" as const;
}

/**
 * A class representing a comparison operation (e.g., equals, greater-than).
 */
export class ComparatorExpression extends Expression {
    /** The type of the expression (always 'comparator'). */
    readonly type = "comparator" as const;
    /** The comparator operation (e.g., equals, greater-than). */
    comparator: Comparator;
    /** Whether the comparison is negated (e.g., not equals). */
    negated: boolean;
    /** Whether the comparison is strict (type-sensitive). */
    strict: boolean;

    constructor(
        options: {
            comparator: Comparator,
            negated: boolean,
            strict: boolean,
            left?: Expression,
            right?: Expression
        }
    ) {
        super(options.left, options.right);
        this.comparator = options.comparator;
        this.negated = options.negated;
        this.strict = options.strict;
    }
}

/**
 * A class representing a logical operator (e.g., &&, ||).
 */
export class OperatorExpression extends Expression {
    /** The type of the expression (always 'operator'). */
    readonly type = "operator" as const;
    /** The logical operator. */
    operator: Operator;

    constructor(options: { operator: Operator, left?: Expression, right?: Expression }) {
        super(options.left, options.right);
        this.operator = options.operator;
    }
}

/**
 * A class representing a property path.
 */
export class PropertyExpression extends Expression {
    /** The type of the expression (always 'property'). */
    readonly type = "property" as const;
    /** The property info for the path. */
    property: PropertyInfo<any>;

    constructor(options: { property: PropertyInfo<any> }) {
        super();
        this.property = options.property;
    }
}

/**
 * A class representing a literal value.
 */
export class ValueExpression extends Expression {
    /** The type of the expression (always 'value'). */
    readonly type = "value" as const;
    /** The literal value. */
    value: unknown;

    constructor(options: {
        value: unknown
    }) {
        super();
        this.value = options.value;
    }
}

/**
 * The set of possible expression types.
 */
export type ExpressionType = "operator" | "comparator" | "property" | "value" | "empty" | "not-parsable";

/**
 * Supported comparator operations for expressions.
 */
export type Comparator =
    | "equals"
    | "starts-with"
    | "includes"
    | "ends-with"
    | "greater-than"
    | "greater-than-equals"
    | "less-than"
    | "less-than-equals";

/**
 * Supported logical operators for expressions.
 */
export type Operator = "&&" | "||";

/**
 * A function that filters a value of type T and returns a boolean.
 */
export type Filter<T extends any> = (value: T) => boolean;

/**
 * A function that filters a value of type T with additional parameters P.
 */
export type ParamsFilter<T extends any, P> = (payload: [T, P]) => boolean;

/**
 * A filter that can be either a simple filter or a parameterized filter.
 */
export type CompositeFilter<T extends any, P = never> = Filter<T> | ParamsFilter<T, P>;

/**
 * An object that can be filtered using a composite filter and optional parameters.
 */
export type Filterable<T extends any, P = any> = {
    /** The filter function. */
    filter: CompositeFilter<T, P>;
    /** Optional parameters for the filter. */
    params?: P;
}