import { QueryOptionExecutionTarget } from "../plugins";
import { CompiledSchemaCore, PropertyInfo } from "../schema";

/**
 * JSON-safe form of a literal. Tagged only where JSON cannot carry the value as it is.
 *
 * See `Expression.toJson`.
 */
export type SerializedValue =
    | { k: "raw"; v: string | number | boolean | null }
    | { k: "date"; v: string }
    | { k: "undefined" }
    | { k: "number"; v: "NaN" | "Infinity" | "-Infinity" }
    | { k: "array"; v: SerializedValue[] };

/** JSON-safe form of an expression tree. See `Expression.toJson`. */
export type SerializedExpression =
    | { t: "empty" }
    | { t: "not-parsable" }
    | { t: "operator"; operator: Operator; left?: SerializedExpression; right?: SerializedExpression }
    | {
        t: "comparator";
        comparator: Comparator;
        negated: boolean;
        strict: boolean;
        left?: SerializedExpression;
        right?: SerializedExpression;
    }
    | { t: "call"; call: Call; expression: SerializedExpression; arguments: SerializedExpression[] }
    | { t: "property"; path: string; transformer: Transformer | null; locale: string | null }
    | { t: "value"; value: SerializedValue; transformer: Transformer | null; locale: string | null };

const valueToJson = (value: unknown): SerializedValue => {
    if (value === undefined) {
        return { k: "undefined" };
    }

    if (value === null) {
        return { k: "raw", v: null };
    }

    if (value instanceof Date) {
        // ISO rather than epoch millis: it survives a human reading the payload, and an invalid
        // Date has no ISO form — so it is caught here rather than becoming a silent `null`.
        return { k: "date", v: value.toISOString() };
    }

    if (Array.isArray(value)) {
        return { k: "array", v: value.map(valueToJson) };
    }

    if (typeof value === "number" && Number.isFinite(value) === false) {
        // `JSON.stringify` turns all three of these into `null`, which would compare as a different
        // value entirely rather than failing.
        return { k: "number", v: Number.isNaN(value) ? "NaN" : value > 0 ? "Infinity" : "-Infinity" };
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return { k: "raw", v: value };
    }

    throw new Error(
        `Cannot serialize this filter value: only strings, numbers, booleans, null, undefined, Dates and arrays of those can cross a wire.  ` +
        `Received: ${Object.prototype.toString.call(value)}`
    );
};

const valueFromJson = (value: SerializedValue): unknown => {
    if (value.k === "undefined") {
        return undefined;
    }

    if (value.k === "date") {
        return new Date(value.v);
    }

    if (value.k === "array") {
        return value.v.map(valueFromJson);
    }

    if (value.k === "number") {
        return value.v === "NaN" ? Number.NaN : value.v === "Infinity" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }

    return value.v;
};

export type ParsedExpression = {
    expression: Expression;
    // Will be memory when trying to query on an untracked computed property or on a function
    executionTarget: QueryOptionExecutionTarget;
}

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

    /**
     * Turns a tree into plain JSON, so a whole query can cross a wire.
     *
     * On the class rather than beside it, because this is the type's own REPRESENTATION — there is one
     * right answer and it belongs with the thing being represented, next to `EMPTY` and `isEmpty`.
     * Rendering a tree into some other language (`toSql`, `toMql`, `evaluate`) is a different kind of
     * thing: there are many, each belongs to its consumer, and none of them is canonical.
     *
     * ## Why it is this small
     *
     * Of the seven node types a bound tree can contain, exactly one holds anything JSON cannot carry:
     * `PropertyExpression`, whose live `PropertyInfo` has functions, a parent chain and caches. It
     * reduces to a property PATH — `PropertyInfo.id` IS the dotted path, and `getProperty` is keyed by
     * exactly that — so rebinding is one lookup.
     *
     * `ParamReferenceExpression` never appears: it is a parse-time placeholder that binding replaces
     * with a plain `ValueExpression` holding the resolved value. A serialized tree is always already
     * bound, so there is no params object to send alongside it.
     *
     * Switches on `type` rather than using the `isXExpression` guards, which live in `../assertions`
     * and import this module — the guards test the same discriminant, so nothing is lost.
     */
    static toJson(expression: Expression): SerializedExpression {

        if (expression.type === "operator") {
            const operator = expression as OperatorExpression;

            return {
                t: "operator",
                operator: operator.operator,
                ...(operator.left != null && { left: Expression.toJson(operator.left) }),
                ...(operator.right != null && { right: Expression.toJson(operator.right) }),
            };
        }

        if (expression.type === "comparator") {
            const comparator = expression as ComparatorExpression;

            return {
                t: "comparator",
                comparator: comparator.comparator,
                negated: comparator.negated,
                strict: comparator.strict,
                ...(comparator.left != null && { left: Expression.toJson(comparator.left) }),
                ...(comparator.right != null && { right: Expression.toJson(comparator.right) }),
            };
        }

        if (expression.type === "call") {
            const call = expression as CallExpression;

            return {
                t: "call",
                call: call.call,
                expression: Expression.toJson(call.expression),
                arguments: call.arguments.map(Expression.toJson),
            };
        }

        if (expression.type === "property") {
            const property = expression as PropertyExpression;

            return {
                t: "property",
                // The dotted path, which is exactly the key `getProperty` is looking up
                path: property.property.id,
                transformer: property.transformer,
                locale: property.locale,
            };
        }

        if (expression.type === "value") {
            const value = expression as ValueExpression;

            return {
                t: "value",
                value: valueToJson(value.value),
                transformer: value.transformer,
                locale: value.locale,
            };
        }

        return expression.type === "empty" ? { t: "empty" } : { t: "not-parsable" };
    }

    /**
     * Rebuilds a tree from JSON, rebinding every property against `schema`.
     *
     * The schema is SUPPLIED rather than read out of the payload. A filter always belongs to a known
     * collection, and the RECEIVER's schema is the authority on what its properties are — taking an
     * id from the payload would mean rebinding against a schema the sender chose, which is backwards
     * for anything crossing a trust boundary.
     *
     * @throws when a property path is not declared by `schema`. Not `NOT_PARSABLE`: on a receiver, a
     * filter that silently stops filtering returns rows the requester excluded, which is the one
     * failure here worse than an error.
     */
    static fromJson(json: SerializedExpression, schema: CompiledSchemaCore<any>): Expression {

        const child = (node: SerializedExpression | undefined) => node == null ? undefined : Expression.fromJson(node, schema);

        if (json.t === "operator") {
            return new OperatorExpression({ operator: json.operator, left: child(json.left), right: child(json.right) });
        }

        if (json.t === "comparator") {
            return new ComparatorExpression({
                comparator: json.comparator,
                negated: json.negated,
                strict: json.strict,
                left: child(json.left),
                right: child(json.right),
            });
        }

        if (json.t === "call") {
            if (json.expression == null) {
                throw new Error(
                    `Cannot deserialize a filter: a '${json.call}' call carries no operand.  ` +
                    `Collection: ${schema.collectionName}.`
                );
            }

            return new CallExpression({
                call: json.call,
                expression: Expression.fromJson(json.expression, schema),
                arguments: (json.arguments ?? []).map(argument => Expression.fromJson(argument, schema)),
            });
        }

        if (json.t === "property") {
            const property = schema.getProperty(json.path);

            if (property == null) {
                throw new Error(
                    `Cannot deserialize a filter: this schema does not declare the property it names.  ` +
                    `Property: ${json.path}, Collection: ${schema.collectionName}.  ` +
                    `The two sides disagree about the shape of the data, so the filter cannot be applied.`
                );
            }

            const rebuilt = new PropertyExpression({ property });
            rebuilt.transformer = json.transformer;
            rebuilt.locale = json.locale;

            return rebuilt;
        }

        if (json.t === "value") {
            const rebuilt = new ValueExpression({ value: valueFromJson(json.value) });
            rebuilt.transformer = json.transformer;
            rebuilt.locale = json.locale;

            return rebuilt;
        }

        return json.t === "empty" ? Expression.EMPTY : Expression.NOT_PARSABLE;
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
    transformer: Transformer | null = null;
    locale: string | null = null;

    constructor(options: { property: PropertyInfo<any> }) {
        super();
        this.property = options.property;
    }
}

export class CallExpression extends Expression {
    readonly type = "call" as const;
    call: Call;
    expression: Expression;
    /** Empty for a unary call. */
    arguments: Expression[];

    constructor(options: { call: Call, expression: Expression, arguments?: Expression[] }) {
        super();
        this.call = options.call;
        this.expression = options.expression;
        this.arguments = options.arguments ?? [];
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

    transformer: Transformer | null = null;
    locale: string | null = null;

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
export type ExpressionType = "operator" | "comparator" | "property" | "value" | "call" | "empty" | "not-parsable";

/**
 * Supported value transformations that can be applied to values.
 * `length` reads the length of a string or array property.
 */
export type Transformer = "to-lower-case" | "to-upper-case" | "length";

/**
 * The names claimed so far. A name absent here is not refused — `specs/filter-expressions.md` lists
 * both the refusals and their reasons, and is longer than this union.
 */
export type Call =
    | "to-lower-case" | "to-upper-case" | "length" | "trim" | "trim-start" | "trim-end"
    | "index-of" | "substring" | "concat" | "replace" | "replace-all"
    | "absolute" | "floor" | "ceiling" | "round" | "sign" | "square-root" | "power"
    | "add" | "subtract" | "multiply" | "divide" | "modulo"
    | "utc-year" | "utc-month" | "utc-day-of-month" | "utc-day-of-week"
    | "utc-hour" | "utc-minute" | "utc-second" | "utc-millisecond" | "epoch-ms"
    | "to-string" | "to-number" | "to-boolean" | "type-of"
    | "some" | "every";

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
};