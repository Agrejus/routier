import { QueryOptionExecutionTarget } from "../plugins";
import { CompiledSchema, SchemaTypes } from "../schema";
import { Expression, OperatorExpression, ComparatorExpression, ValueExpression, PropertyExpression, Filter, ParamsFilter, Operator, ParsedExpression } from "./types";

// Pre-compiled regex patterns for better performance
const METHOD_REGEX = /([a-zA-Z0-9_.]+)\.(startsWith|endsWith|includes)\(([^)]+)\)(\s*(===|==|!==|!=)\s*(true|false))?/;
const TRANSFORM_METHOD_REGEX = /([a-zA-Z0-9_.]+)\.(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase)\(\)\.(startsWith|endsWith|includes)\(((?:[^()]|\([^)]*\))*)\)(\s*(===|==|!==|!=)\s*(true|false))?/;
const EQUALITY_REGEX = /([^=!<>]+?)\s*(===|==|!==|!=)\s*(.+)/;
const COMPARISON_REGEX = /([^=!<>]+?)\s*(>=|<=|>|<)\s*(.+)/;
const PARAM_PATH_REGEX = /^([a-zA-Z0-9_.]+)/;

// Pre-compiled regex patterns for comment removal
const SINGLE_LINE_COMMENT_REGEX = /\/\/.*$/gm;
const MULTI_LINE_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const WHITESPACE_REGEX = /\s+/g;

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

// Optimized comparator lookup using Map
const COMPARATOR_MAP = new Map(Object.entries(comparators));

// Error message constants
const ERROR_MESSAGES = {
    COMPARATOR_NOT_FOUND: (value: string) => `Cannot find comparator: ${value}`,
    PROPERTY_NOT_FOUND: (path: string) => `Error parsing query, could not find PropertyInfo for path: ${path}`,
    PARAM_PATH_NOT_FOUND: (value: string, params: any) => `Cannot find path in params for .where(). Make sure parameters are not used inline.\r\nPath: ${value}, Params: ${JSON.stringify(params)}`
};

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

export const toParsedExpression = <T extends any, P extends any>(schema: CompiledSchema<any>, fn: Filter<T> | ParamsFilter<T, P>, params?: P): ParsedExpression => {
    try {

        const stringifiedFunction = fn.toString();

        // Optimized string parsing
        const arrowIndex = stringifiedFunction.indexOf('=>');
        if (arrowIndex === -1) {
            throw new Error("Invalid Function");
        }

        const parameterNames = stringifiedFunction.substring(0, arrowIndex).trim();
        let expression = stringifiedFunction.substring(arrowIndex + 2).trim();

        // Remove JavaScript comments from the expression
        expression = expression
            .replace(SINGLE_LINE_COMMENT_REGEX, '') // Remove single-line comments
            .replace(MULTI_LINE_COMMENT_REGEX, '') // Remove multi-line comments
            .replace(WHITESPACE_REGEX, ' ') // Normalize whitespace
            .trim();

        let parameterData: { name: string, data: P } | undefined = undefined;

        if (params != null) {
            let name: string;
            if (parameterNames.includes("[") && parameterNames.includes("]")) {
                // Optimized parameter name extraction
                const commaIndex = parameterNames.indexOf(",");
                if (commaIndex !== -1) {
                    const bracketIndex = parameterNames.indexOf("]", commaIndex);
                    if (bracketIndex !== -1) {
                        name = parameterNames.substring(commaIndex + 1, bracketIndex).trim();
                    }
                }
            }

            parameterData = {
                name,
                data: params
            };
        }

        return parseExpressionToTree(schema, expression, parameterData);
    } catch (e) {
        console.warn("Error parsing expression", e);
        return {
            expression: Expression.NOT_PARSABLE,
            executionTarget: "memory"
        };
    }
}

const parseExpressionToTree = <P extends any>(schema: CompiledSchema<any>, expression: string, params?: { name: string, data: P }): ParsedExpression => {

    let executionTarget: QueryOptionExecutionTarget = "database";
    const parse = (exp: string): Expression => {
        // Remove any wrapping parentheses
        exp = exp.trim();
        if (exp.startsWith('(') && exp.endsWith(')')) {
            let depth = 0;
            let isWrapper = true;
            for (let i = 0; i < exp.length; i++) {
                const char = exp[i];
                if (char === '(') {
                    depth++;
                } else if (char === ')') {
                    depth--;
                    if (depth < 0) break; // Early exit for invalid parentheses
                }
                // Early exit if we find a closing parenthesis that's not the last character
                if (depth === 0 && i !== exp.length - 1) {
                    isWrapper = false;
                    break; // Early exit
                }
                // Early exit if we go negative (invalid parentheses)
                if (depth < 0) {
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

        for (let i = 0; i < exp.length - 1; i++) {
            const char = exp[i];
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (depth === 0) {
                // Optimized operator detection using character comparison
                if (char === '&' && exp[i + 1] === '&') {
                    operator = '&&';
                    splitIndex = i;
                    break; // AND takes precedence over OR
                } else if (operator === null && char === '|' && exp[i + 1] === '|') {
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

        // If no operator, try to parse as a condition
        const condition = parseCondition(schema, exp, params);

        // set the execution target to memory
        if (condition.executionTarget === "memory" && executionTarget != "memory") {
            executionTarget = "memory";
        }

        return condition.expression
    }

    const parsedExpression = parse(expression);

    return {
        expression: parsedExpression,
        executionTarget
    }
}

const convertAndAssignValue = (valueExpression: unknown, propertyPathExpression: unknown) => {

    assertIsPropertyPathExpression(propertyPathExpression);

    assertIsValueExpression(valueExpression)

    const propertyType = propertyPathExpression.property.type;

    valueExpression.value = converters[propertyType](valueExpression.value);
}

const converters: Record<SchemaTypes, (value: unknown) => unknown> = {
    Array: v => v,
    Boolean: v => v == null ? v : Boolean(v),
    Computed: v => v,
    Date: v => v,
    Definition: v => v,
    Function: v => v,
    Number: v => v == null ? v : Number(v),
    Object: v => v,
    String: v => v == null ? v : String(v)
};

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

// Helper function to detect if a string is a property path
const isPropertyPath = (value: string): boolean => {
    return value.includes('.') && value.match(/^[a-zA-Z0-9_.]+$/) !== null;
};

// Helper function to determine if we need to swap the operator for reversed comparisons
const getSwappedOperator = (operator: string): string => {
    const swapMap: Record<string, string> = {
        '>': '<',
        '<': '>',
        '>=': '<=',
        '<=': '>='
    };
    return swapMap[operator] || operator;
};

const parseCondition = <P extends any>(schema: CompiledSchema<any>, expression: string, params?: { name: string, data: P }): ParsedExpression => {

    // Optimized string operations - single trim operation
    const trimmed = expression.trim();
    const isNegation = trimmed.startsWith('!');
    const finalExpression = isNegation ? trimmed.slice(1).trim() : trimmed;

    // Enhanced pattern matching for complex expressions
    const methodMatch = finalExpression.match(METHOD_REGEX);
    const transformMethodMatch = finalExpression.match(TRANSFORM_METHOD_REGEX);
    const equalityMatch = finalExpression.match(EQUALITY_REGEX);
    const comparisonMatch = finalExpression.match(COMPARISON_REGEX);

    if (methodMatch) {
        // Handle .startsWith or .endsWith
        const comparator = getComparator(methodMatch[2]);

        if (isNegation) {
            comparator.negated = isNegation;
        }

        // Check if the left side is a parameter path
        const leftSide = methodMatch[1];
        if (params && leftSide.startsWith(params.name)) {
            // This is a parameter path, not a property path
            // For now, return NOT_PARSABLE for complex parameter-based method calls
            return {
                expression: Expression.NOT_PARSABLE,
                executionTarget: "memory"
            };
        }

        const propertyExpression = getProperty(schema, leftSide);

        comparator.left = propertyExpression;
        comparator.right = getValue(methodMatch[3], params);

        // If the comparison is explicitly to false, mark it as negated
        if (methodMatch[6] === "false") {
            comparator.negated = true;
        }

        return {
            expression: comparator,
            executionTarget: propertyExpression.property.isUnmapped ? "memory" : "database"
        };
    }

    // Check for transformations on the value side (right side of comparison) - check this FIRST
    const valueTransformMatch = finalExpression.match(/([^=!<>]+?)\s*(===|==|!==|!=)\s*([^)]+)\.(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase)\(\)/);
    if (valueTransformMatch) {
        const comparator = getComparator(valueTransformMatch[2]);

        if (isNegation) {
            comparator.negated = isNegation;
        }

        // Create the property expression for the left side (no transformer)
        const propertyExpression = getProperty(schema, valueTransformMatch[1].trim());

        // Create a ValueExpression for the right side with transformer
        const valueExpression = getValue(valueTransformMatch[3], params);

        // Set transformer and locale based on the method
        const method = valueTransformMatch[4];
        if (method === 'toLowerCase' || method === 'toLocaleLowerCase') {
            valueExpression.transformer = 'to-lower-case';
            if (method === 'toLocaleLowerCase') {
                valueExpression.locale = 'en-US';
            }
        } else {
            valueExpression.transformer = 'to-upper-case';
            if (method === 'toLocaleUpperCase') {
                valueExpression.locale = 'en-US';
            }
        }

        comparator.left = propertyExpression;
        comparator.right = valueExpression;

        return {
            expression: comparator,
            executionTarget: propertyExpression.property.isUnmapped ? "memory" : "database"
        };
    }

    if (transformMethodMatch) {
        // Handle .toLowerCase or .toUpperCase on the property side
        const comparator = getComparator(transformMethodMatch[3]); // e.g., startsWith, endsWith, includes

        if (isNegation) {
            comparator.negated = isNegation;
        }

        // Create the property expression for the left side with transformer
        const propertyExpression = getProperty(schema, transformMethodMatch[1]);

        // Set transformer and locale based on the method
        const method = transformMethodMatch[2];
        if (method === 'toLowerCase' || method === 'toLocaleLowerCase') {
            propertyExpression.transformer = 'to-lower-case';
            if (method === 'toLocaleLowerCase') {
                propertyExpression.locale = 'en-US'; // Default locale, could be extracted from method call
            }
        } else {
            propertyExpression.transformer = 'to-upper-case';
            if (method === 'toLocaleUpperCase') {
                propertyExpression.locale = 'en-US'; // Default locale, could be extracted from method call
            }
        }

        // Create a ValueExpression for the right side
        let valueExpression = getValue(transformMethodMatch[4], params);

        // Check if the value also has a transformation (but only if it's not already handled by value-side check)
        const valueTransformMatch = transformMethodMatch[4].match(/^([^)]+)\.(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase)\(\)$/);

        if (valueTransformMatch) {
            // Create a new ValueExpression with the base value and transformer
            valueExpression = new ValueExpression({
                value: valueTransformMatch[1].replace(/^["']|["']$/g, '') // Remove quotes
            });

            // Set transformer and locale based on the method
            const valueMethod = valueTransformMatch[2];
            if (valueMethod === 'toLowerCase' || valueMethod === 'toLocaleLowerCase') {
                valueExpression.transformer = 'to-lower-case';
                if (valueMethod === 'toLocaleLowerCase') {
                    valueExpression.locale = 'en-US'; // Default locale
                }
            } else {
                valueExpression.transformer = 'to-upper-case';
                if (valueMethod === 'toLocaleUpperCase') {
                    valueExpression.locale = 'en-US'; // Default locale
                }
            }
        }

        comparator.left = propertyExpression;
        comparator.right = valueExpression;

        // If the comparison is explicitly to false, mark it as negated
        if (transformMethodMatch[7] === "false") {
            comparator.negated = true;
        }

        return {
            expression: comparator,
            executionTarget: propertyExpression.property.isUnmapped ? "memory" : "database"
        };
    }

    if (equalityMatch) {
        const left = equalityMatch[1].trim();
        const operator = equalityMatch[2];
        const right = equalityMatch[3].trim();

        const leftIsProperty = isPropertyPath(left);
        const rightIsProperty = isPropertyPath(right);

        // Determine which side is the property and which is the value
        let propertySide: string, valueSide: string, finalOperator: string;

        if (leftIsProperty && !rightIsProperty) {
            // Normal case: property === value
            propertySide = left;
            valueSide = right;
            finalOperator = operator;
        } else if (!leftIsProperty && rightIsProperty) {
            // Reversed case: value === property
            propertySide = right;
            valueSide = left;
            finalOperator = operator;
        } else {
            // Both sides look like properties or neither does - assume left is property
            propertySide = left;
            valueSide = right;
            finalOperator = operator;
        }

        const comparator = getComparator(finalOperator);

        if (isNegation) {
            comparator.negated = isNegation;
        }

        const propertyExpression = getProperty(schema, propertySide);
        comparator.left = propertyExpression;
        comparator.right = getValue(valueSide, params);

        convertAndAssignValue(comparator.right, comparator.left);

        return {
            expression: comparator,
            executionTarget: propertyExpression.property.isUnmapped ? "memory" : "database"
        };
    }

    if (comparisonMatch) {
        const left = comparisonMatch[1].trim();
        const operator = comparisonMatch[2];
        const right = comparisonMatch[3].trim();

        const leftIsProperty = isPropertyPath(left);
        const rightIsProperty = isPropertyPath(right);

        // Determine which side is the property and which is the value
        let propertySide: string, valueSide: string, finalOperator: string;

        if (leftIsProperty && !rightIsProperty) {
            // Normal case: property > value
            propertySide = left;
            valueSide = right;
            finalOperator = operator;
        } else if (!leftIsProperty && rightIsProperty) {
            // Reversed case: value > property -> property < value
            propertySide = right;
            valueSide = left;
            finalOperator = getSwappedOperator(operator);
        } else {
            // Both sides look like properties or neither does - assume left is property
            propertySide = left;
            valueSide = right;
            finalOperator = operator;
        }

        const comparator = getComparator(finalOperator);

        if (isNegation) {
            comparator.negated = isNegation;
        }

        const propertyExpression = getProperty(schema, propertySide);
        comparator.left = propertyExpression;
        comparator.right = getValue(valueSide, params);

        convertAndAssignValue(comparator.right, comparator.left);

        return {
            expression: comparator,
            executionTarget: propertyExpression.property.isUnmapped ? "memory" : "database"
        };
    }

    // If we get here, the expression is too complex for the current parser
    // This is expected for complex real-world expressions
    throw new Error(`Unsupported expression format: ${finalExpression}`);
}

const getComparator = (value: string): ComparatorExpression => {

    const comparator = COMPARATOR_MAP.get(value);

    if (comparator == null) {
        throw new Error(ERROR_MESSAGES.COMPARATOR_NOT_FOUND(value))
    }

    // Return a new instance to avoid modifying the cached one
    return new ComparatorExpression({
        comparator: comparator.comparator,
        negated: comparator.negated,
        strict: comparator.strict
    });
}

const getValue = <P extends any>(value: string, params?: { name: string, data: P }): ValueExpression => {

    // Early return for string literals
    if (value.startsWith("\'") || value.startsWith("\"")) {
        return new ValueExpression({
            value: value.replace(/\"|\'/g, "")
        });
    }

    // Early return for null/undefined
    if (value === "null") {
        return new ValueExpression({ value: null });
    }

    if (value === "undefined" || value === "void 0") {
        return new ValueExpression({ value: undefined });
    }

    // Optimized number parsing with early return
    const numValue = +value;
    if (!isNaN(numValue) && isFinite(numValue)) {
        return new ValueExpression({ value: numValue });
    }

    // Handle parameter paths if params are provided
    if (params != null) {
        // Check if this is a parameter path (starts with params.name)
        if (value.startsWith(params.name)) {
            return new ValueExpression({
                value: getValueFromParams(value, params)
            });
        }

        // Check if this is a parameter path without the params prefix
        if (value.includes('.')) {
            // Try to extract the parameter path
            const paramMatch = value.match(PARAM_PATH_REGEX);
            if (paramMatch) {
                const potentialParamPath = paramMatch[1];
                try {
                    const paramValue = getValueFromParams(`${params.name}.${potentialParamPath}`, params);
                    return new ValueExpression({ value: paramValue });
                } catch (e) {
                    // Not a parameter path, continue with normal parsing
                }
            }
        }
    }

    // Default case: return as-is
    return new ValueExpression({ value });
}

const getValueFromParams = <P extends any>(value: string, params: { name: string, data: P }) => {

    const split = value.split('.');

    // Early exit for invalid paths
    if (split.length === 1) {
        throw new Error(ERROR_MESSAGES.PARAM_PATH_NOT_FOUND(value, params.data))
    }

    let result = params.data as any;

    // For nested params - start from index 1 to skip the params prefix
    for (let i = 1; i < split.length; i++) {
        const name = split[i];

        if (name in result) {
            result = result[name];
            continue;
        }

        throw new Error(ERROR_MESSAGES.PARAM_PATH_NOT_FOUND(value, params.data))
    }

    return result;
}

const getProperty = (schema: CompiledSchema<any>, value: string): PropertyExpression => {
    // Optimized string splitting - only split if we have the expected pattern
    if (!value.includes('.')) {
        throw new Error(ERROR_MESSAGES.PROPERTY_NOT_FOUND(value));
    }

    const pathSplit = value.split(/[?!.]/g).slice(1);
    const pathString = pathSplit.join(".");

    // Early exit if no path found
    if (!pathString) {
        throw new Error(ERROR_MESSAGES.PROPERTY_NOT_FOUND(value));
    }

    const found = schema.properties.find(w => w.getAssignmentPath() == pathString);

    if (found == null) {
        throw new Error(ERROR_MESSAGES.PROPERTY_NOT_FOUND(value));
    }

    return new PropertyExpression({ property: found });
}


