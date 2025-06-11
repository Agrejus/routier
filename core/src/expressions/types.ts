import { PropertyInfo } from "../common/PropertyInfo";
import { GenericFunction } from "../types";

/**
 * An expression representing a comparison operation (e.g., equals, greater-than).
 */
export interface ComparatorExpression extends Expression {
    /** The type of the expression (always 'comparator'). */
    type: "comparator";
    /** The comparator operation (e.g., equals, greater-than). */
    comparator: Comparator;
    /** Whether the comparison is negated (e.g., not equals). */
    negated: boolean;
    /** Whether the comparison is strict (type-sensitive). */
    strict: boolean;
}

/**
 * An expression representing a logical operator (e.g., &&, ||).
 */
export interface OperatorExpression extends Expression {
    /** The type of the expression (always 'operator'). */
    type: "operator";
    /** The logical operator. */
    operator: Operator;
}

/**
 * The base interface for all expression types.
 */
export interface Expression {
    /** The type of the expression. */
    type: ExpressionType;
    /** The left-hand side of the expression (if applicable). */
    left?: Expression;
    /** The right-hand side of the expression (if applicable). */
    right?: Expression;
}

/**
 * An expression representing a property path.
 */
export interface PropertyPathExpression extends Expression {
    /** The type of the expression (always 'property'). */
    type: "property";
    /** The property info for the path. */
    property: PropertyInfo<any>;
}

/**
 * An expression representing a literal value.
 */
export interface ValueExpression extends Expression {
    /** The type of the expression (always 'value'). */
    type: "value";
    /** The literal value. */
    value: unknown;
}

/**
 * The set of possible expression types.
 */
export type ExpressionType = "operator" | "comparator" | "property" | "value";

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
export type Filter<T extends any> = GenericFunction<T, boolean>;

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