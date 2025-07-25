import { CompiledSchema, SchemaTypes } from "../schema";
import { Expression, OperatorExpression, ComparatorExpression, ValueExpression, PropertyExpression, Filter, ParamsFilter, Operator } from "./types";

// need to have negated + strict
const comparators: Record<string, ComparatorExpression> = {
    startsWith: new ComparatorExpression({
        comparator: "starts-with",
        negated: false,
        strict: false
    }),
    endsWith: new ComparatorExpression({
        comparator: "ends-with",
        negated: false,
        strict: false
    }),
    includes: new ComparatorExpression({
        comparator: "includes",
        negated: false,
        strict: false
    }),
    "==": new ComparatorExpression({
        comparator: "equals",
        negated: false,
        strict: false
    }),
    "===": new ComparatorExpression({
        comparator: "equals",
        negated: false,
        strict: true
    }),
    "!=": new ComparatorExpression({
        comparator: "equals",
        negated: true,
        strict: false
    }),
    "!==": new ComparatorExpression({
        comparator: "equals",
        negated: true,
        strict: true
    }),
    ">=": new ComparatorExpression({
        comparator: "greater-than-equals",
        negated: false,
        strict: false
    }),
    ">==": new ComparatorExpression({
        comparator: "greater-than-equals",
        negated: false,
        strict: true
    }),
    "<=": new ComparatorExpression({
        comparator: "less-than-equals",
        negated: false,
        strict: false
    }),
    "<==": new ComparatorExpression({
        comparator: "less-than-equals",
        negated: false,
        strict: true
    }),
    ">": new ComparatorExpression({
        comparator: "greater-than",
        negated: false,
        strict: false
    }),
    "<": new ComparatorExpression({
        comparator: "less-than",
        negated: false,
        strict: false
    })
} as const;

export const combineExpressions = (...expressions: Expression[]): Expression => {

    if (expressions.length === 0) {
        throw new Error("combineExpressions requires at least 1 expression");
    }


    if (expressions.length === 1) {
        return expressions[0];
    }

    // Start with the first expression
    let result = expressions[0];

    // Loop through remaining expressions and combine them
    for (let i = 1; i < expressions.length; i++) {
        result = new OperatorExpression({
            operator: "&&",
            left: result,
            right: expressions[i]
        });
    }

    return result;
};

export const toExpression = <T extends any, P extends any>(schema: CompiledSchema<any>, fn: Filter<T> | ParamsFilter<T, P>, params?: P) => {
    try {

        const stringifiedFunction = fn.toString();

        const [parameterNames, expression, ...rest] = stringifiedFunction.split("=>").map(w => w.trim());

        if (rest.length > 0) {
            throw new Error("Invalid Function")
        }

        let parameterData: { name: string, data: P } | undefined = undefined;

        if (params != null) {

            let name: string;
            if (parameterNames.includes("[") && parameterNames.includes("]")) {
                name = parameterNames.split(",")[1].replace(")", "").replace("]", "").trim()
            }

            parameterData = {
                name,
                data: params
            }
        }

        return parseExpressionToTree(schema, expression, parameterData);
    } catch (e) {
        console.warn("Error parsing expression", e);
        return Expression.NOT_PARSABLE
    }
}

const parseExpressionToTree = <P extends any>(schema: CompiledSchema<any>, expression: string, params?: { name: string, data: P }) => {

    const parse = (exp: string): Expression => {
        // Remove any wrapping parentheses
        exp = exp.trim();
        if (exp.startsWith('(') && exp.endsWith(')')) {
            let depth = 0;
            let isWrapper = true;
            for (let i = 0; i < exp.length; i++) {
                if (exp[i] === '(') depth++;
                else if (exp[i] === ')') depth--;
                if (depth === 0 && i !== exp.length - 1) {
                    isWrapper = false;
                    break;
                }
            }
            if (isWrapper) {
                exp = exp.slice(1, -1).trim();
            }
        }

        // Parse based on the operator precedence
        let operator: Operator | null = null, splitIndex = -1, depth = 0;

        for (let i = 0; i < exp.length; i++) {
            const char = exp[i];
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (depth === 0) {
                if (exp.slice(i, i + 2) === '&&') {
                    operator = '&&';
                    splitIndex = i;
                    break; // AND takes precedence over OR
                } else if (operator === null && exp.slice(i, i + 2) === '||') {
                    operator = '||';
                    splitIndex = i;
                }
            }
        }

        if (operator) {
            const left = exp.slice(0, splitIndex).trim();
            const right = exp.slice(splitIndex + 2).trim();

            return new OperatorExpression({
                operator,
                left: parse(left),
                right: parse(right)
            });
        }

        // If no operator, it's a terminal condition (handles `==` or `startsWith`)
        return parseCondition(schema, exp, params);
    }

    return parse(expression);
}

const convertAndAssignValue = (valueExpression: unknown, propertyPathExpression: unknown) => {

    assertIsPropertyPathExpression(propertyPathExpression);

    assertIsValueExpression(valueExpression)

    const propertyType = propertyPathExpression.property.type;

    valueExpression.value = converters[propertyType](valueExpression.value)
}

const converters: Record<SchemaTypes, (value: unknown) => unknown> = {
    Array: v => v,
    Boolean: v => Boolean(v),
    Computed: v => v,
    Date: v => v,
    Definition: v => v,
    Function: v => v,
    Number: v => Number(v),
    Object: v => v,
    String: v => String(v)
}

const isExpression = (value: unknown): value is Expression => {
    return typeof value === "object" && value !== null && "type" in value;
}

function assertIsExpression(value: unknown): asserts value is Expression {
    if (isExpression(value) === false) {
        throw new Error("Assertion Failed: Value is not a Expression")
    }
}

function assertIsPropertyPathExpression(value: unknown): asserts value is PropertyExpression {

    assertIsExpression(value);

    if (!("property" in value)) {
        throw new Error("Assertion Failed: Value is not a PropertyPathExpression")
    }
}

function assertIsValueExpression(value: unknown): asserts value is ValueExpression {

    assertIsExpression(value);

    if (!("value" in value)) {
        throw new Error("Assertion Failed: Value is not a ValueExpression")
    }
}

const parseCondition = <P extends any>(schema: CompiledSchema<any>, expression: string, params?: { name: string, data: P }): ComparatorExpression => {

    // Remove any leading/trailing whitespace
    expression = expression.trim();

    // Handle negations (!)
    const isNegation = expression.startsWith('!');
    let negated = false;
    if (isNegation) {
        expression = expression.slice(1).trim();
        negated = true;
    }

    // Match patterns for methods like startsWith/endsWith and operators
    const methodMatch = expression.match(/([a-zA-Z0-9_.]+)\.(startsWith|endsWith|includes)\((.+)\)(\s*(===|==|!==|!=)\s*(true|false))?/);
    const equalityMatch = expression.match(/([a-zA-Z0-9_.]+)\s*(===|==|!==|!=)\s*(.*|\d+|true|false)/);
    const comparisonMatch = expression.match(/([a-zA-Z0-9_.]+)\s*(>=|<=|>|<)\s*(.+)/);

    if (methodMatch) {
        // Handle .startsWith or .endsWith
        const comparator = getComparator(methodMatch[2]);

        if (negated) {
            comparator.negated = negated;
        }

        comparator.left = getProperty(schema, methodMatch[1]);
        comparator.right = getValue(methodMatch[3], params);

        // If the comparison is explicitly to false, mark it as negated
        if (methodMatch[6] === "false") {
            comparator.negated = true;
        }

        return comparator;
    }

    if (equalityMatch) {

        const comparator = getComparator(equalityMatch[2]);

        comparator.left = getProperty(schema, equalityMatch[1]);
        comparator.right = getValue(equalityMatch[3], params);

        convertAndAssignValue(comparator.right, comparator.left);

        return comparator;
    }

    if (comparisonMatch) {

        const comparator = getComparator(comparisonMatch[2]);

        comparator.left = getProperty(schema, comparisonMatch[1]);
        comparator.right = getValue(comparisonMatch[3], params);

        convertAndAssignValue(comparator.right, comparator.left);

        return comparator;
    }

    throw new Error(`Unsupported expression format: ${expression}`);
}

const getComparator = (value: string): ComparatorExpression => {

    const comparator = comparators[value];

    if (comparator == null) {
        throw new Error(`Cannot find comparator:  Comparator: ${value}`)
    }

    return comparator
}

const getValue = <P extends any>(value: string, params?: { name: string, data: P }): ValueExpression => {

    if (value.startsWith("\'") || value.startsWith("\"") || params == null) {
        return new ValueExpression({
            value: value.replace(/\"|\'/g, "")
        });
    }

    if (params != null && value.startsWith(params.name)) {
        return new ValueExpression({
            value: getValueFromParams(value, params)
        });
    }

    if (Number.isFinite(Number(value))) {
        return new ValueExpression({
            value
        });
    }

    throw new Error(`Cannot parse value from selector.  Value: ${value}`);
}

const getValueFromParams = <P extends any>(value: string, params: { name: string, data: P }) => {

    const split = value.split('.');
    let result = params.data as any;

    if (split.length === 1) {
        throw new Error(`Cannot find path in params for .where(). Make sure parameters are not used inline.\r\nPath: ${value}, Params: ${JSON.stringify(params.data)}`)
    }

    // For nested params
    for (let i = 1; i < split.length; i++) {
        const name = split[i];

        if (name in result) {
            result = result[name];
            continue;
        }

        throw new Error(`Cannot find path in params for .where(). Make sure parameters are not used inline.\r\nPath: ${value}, Params: ${JSON.stringify(params.data)}`)
    }

    return result;
}

const getProperty = (schema: CompiledSchema<any>, value: string): PropertyExpression => {

    const pathSplit = value.split(/\?\.|\!\.|\./g);
    pathSplit.shift();
    const found = schema.properties.find(w => w.getAssignmentPath() == pathSplit.join("."));

    if (found == null) {
        throw new Error(`Error parsing query, could not find PropertyInfo for path.  Path: ${value}`)
    }

    return new PropertyExpression({
        property: found
    });
}


