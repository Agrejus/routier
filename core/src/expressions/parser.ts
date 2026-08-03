import { logger } from "../utilities";
import { assertString } from "../assertions";
import { CompiledSchema, PropertyInfo, SchemaTypes } from "../schema";
import { Expression, OperatorExpression, ComparatorExpression, ValueExpression, PropertyExpression, Filter, ParamsFilter, Comparator, Transformer } from "./types";

// Error message constants
const ERROR_MESSAGES = {
    PROPERTY_NOT_FOUND: (path: string) => `Error parsing query, could not find PropertyInfo for path: ${path}`,
    PARAM_PATH_NOT_FOUND: (value: string, params: unknown) => `Cannot find path in params for .where(). Make sure parameters are not used inline.\r\nPath: ${value}, Params: ${JSON.stringify(params)}`,
    VARIABLE_VALUE: (value: string) => `Cannot derive value from variable, please pass parameters into the expression.

Example: .where(([x, params]) => x.id === params.id, { id: someVar.id })
Issue At: ${value}`,
    UNSUPPORTED: (value: string) => `Unsupported expression format: ${value}`
};

const parseUnknown = (value: unknown) => {
    assertString(value);
    return JSON.parse(value);
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

// #region Tokenizer

type TokenKind = "identifier" | "string" | "number" | "punctuation";

type Token = {
    kind: TokenKind;
    value: string;
}

// Longest first so multi-character punctuation wins over its prefixes
const MULTI_CHARACTER_PUNCTUATION = ["===", "!==", "?.", "&&", "||", "==", "!=", ">=", "<=", "=>"] as const;
const SINGLE_CHARACTER_PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ".", ",", ";", "!", ">", "<", "-", "+", "*", "/", "%", "=", "?", ":", "&", "|"]);

const STRING_ESCAPES: Record<string, string> = {
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "b": "\b",
    "f": "\f",
    "v": "\v",
    "0": "\0"
};

const isIdentifierStart = (char: string) => /[a-zA-Z_$]/.test(char);
const isIdentifierPart = (char: string) => /[a-zA-Z0-9_$]/.test(char);
const isDigit = (char: string) => char >= "0" && char <= "9";

/**
 * Converts filter source text into a flat token stream.  Strings and comments are
 * consumed here so operator characters inside literals can never be mistaken for
 * real operators.
 */
const tokenize = (source: string): Token[] => {

    const tokens: Token[] = [];
    let i = 0;

    while (i < source.length) {
        const char = source[i];

        // Whitespace
        if (char === " " || char === "\t" || char === "\r" || char === "\n") {
            i++;
            continue;
        }

        // Comments
        if (char === "/" && source[i + 1] === "/") {
            while (i < source.length && source[i] !== "\n") {
                i++;
            }
            continue;
        }

        if (char === "/" && source[i + 1] === "*") {
            i += 2;
            while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
                i++;
            }
            i += 2;
            continue;
        }

        // String literals
        if (char === "'" || char === "\"" || char === "`") {
            const quote = char;
            let value = "";
            i++;

            while (i < source.length && source[i] !== quote) {
                if (source[i] === "\\") {
                    const escaped = source[i + 1];
                    value += STRING_ESCAPES[escaped] ?? escaped;
                    i += 2;
                    continue;
                }

                if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
                    throw new Error(ERROR_MESSAGES.UNSUPPORTED("template literal interpolation"));
                }

                value += source[i];
                i++;
            }

            if (i >= source.length) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("unterminated string literal"));
            }

            i++; // consume closing quote
            tokens.push({ kind: "string", value });
            continue;
        }

        // Numbers
        if (isDigit(char)) {
            let value = "";

            while (i < source.length && (isDigit(source[i]) || source[i] === ".")) {
                value += source[i];
                i++;
            }

            tokens.push({ kind: "number", value });
            continue;
        }

        // Identifiers / keywords
        if (isIdentifierStart(char)) {
            let value = "";

            while (i < source.length && isIdentifierPart(source[i])) {
                value += source[i];
                i++;
            }

            tokens.push({ kind: "identifier", value });
            continue;
        }

        // Multi-character punctuation (longest match first)
        const multi = MULTI_CHARACTER_PUNCTUATION.find(w => source.startsWith(w, i));

        if (multi != null) {
            tokens.push({ kind: "punctuation", value: multi });
            i += multi.length;
            continue;
        }

        if (SINGLE_CHARACTER_PUNCTUATION.has(char)) {
            tokens.push({ kind: "punctuation", value: char });
            i++;
            continue;
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(`unexpected character '${char}'`));
    }

    return tokens;
}

/**
 * Cursor over the token stream with the small set of lookahead operations the
 * parser needs.
 */
class TokenStream {

    private readonly tokens: Token[];
    private index: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    get isAtEnd() {
        return this.index >= this.tokens.length;
    }

    peek(offset: number = 0): Token | null {
        return this.tokens[this.index + offset] ?? null;
    }

    next(): Token {
        const token = this.tokens[this.index];

        if (token == null) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("unexpected end of expression"));
        }

        this.index++;
        return token;
    }

    isPunctuation(value: string, offset: number = 0): boolean {
        const token = this.peek(offset);
        return token != null && token.kind === "punctuation" && token.value === value;
    }

    matchPunctuation(value: string): boolean {
        if (this.isPunctuation(value)) {
            this.index++;
            return true;
        }

        return false;
    }

    expectPunctuation(value: string) {
        if (!this.matchPunctuation(value)) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`expected '${value}'`));
        }
    }
}

// #endregion

// #region Operands

// Discriminated union so a condition builder can only ever see the operand
// shapes the grammar allows
type PropertyOperand = {
    kind: "property";
    property: PropertyInfo<any>;
    transformer: Transformer | null;
    locale: string | null;
}

type ValueOperand = {
    kind: "value";
    value: unknown;
    transformer: Transformer | null;
    locale: string | null;
}

type ParamOperand = {
    kind: "param";
    path: string[];
    transformer: Transformer | null;
    locale: string | null;
}

type MethodCallOperand = {
    kind: "method-call";
    target: PropertyOperand | ParamOperand;
    method: "startsWith" | "endsWith" | "includes";
    argument: PropertyOperand | ValueOperand | ParamOperand;
}

type Operand = PropertyOperand | ValueOperand | ParamOperand | MethodCallOperand;

const COMPARATOR_METHODS: Record<string, Comparator> = {
    startsWith: "starts-with",
    endsWith: "ends-with",
    includes: "includes"
};

const TRANSFORM_METHODS: Record<string, { transformer: Transformer, locale: string | null }> = {
    toLowerCase: { transformer: "to-lower-case", locale: null },
    toUpperCase: { transformer: "to-upper-case", locale: null },
    toLocaleLowerCase: { transformer: "to-lower-case", locale: "en-US" },
    toLocaleUpperCase: { transformer: "to-upper-case", locale: "en-US" }
};

const COMPARISON_OPERATORS: Record<string, { comparator: Comparator, negated: boolean, strict: boolean }> = {
    "==": { comparator: "equals", negated: false, strict: false },
    "===": { comparator: "equals", negated: false, strict: true },
    "!=": { comparator: "equals", negated: true, strict: false },
    "!==": { comparator: "equals", negated: true, strict: true },
    ">": { comparator: "greater-than", negated: false, strict: false },
    ">=": { comparator: "greater-than-equals", negated: false, strict: false },
    "<": { comparator: "less-than", negated: false, strict: false },
    "<=": { comparator: "less-than-equals", negated: false, strict: false }
};

const SWAPPED_COMPARATORS: Record<Comparator, Comparator> = {
    "equals": "equals",
    "greater-than": "less-than",
    "greater-than-equals": "less-than-equals",
    "less-than": "greater-than",
    "less-than-equals": "greater-than-equals",
    "starts-with": "starts-with",
    "ends-with": "ends-with",
    "includes": "includes"
};

// #endregion

// #region Param references

/**
 * Placeholder for a parameter value inside a cached expression template.  Never
 * escapes this module — binding replaces it with a plain ValueExpression that
 * holds the resolved value.
 */
class ParamReferenceExpression extends ValueExpression {

    /** Path into the params object, excluding the params root name. */
    readonly paramPath: string[];
    /** The property this value is compared against; drives serialization/conversion at bind time. */
    readonly pairedProperty: PropertyInfo<any> | null;
    /** Whether the paired property's type converter applies (equality/relational comparisons only). */
    readonly applyConverter: boolean;

    constructor(options: {
        paramPath: string[],
        pairedProperty: PropertyInfo<any> | null,
        applyConverter: boolean
    }) {
        super({ value: undefined });
        this.paramPath = options.paramPath;
        this.pairedProperty = options.pairedProperty;
        this.applyConverter = options.applyConverter;
    }
}

const resolveParamPath = (paramsName: string, path: string[], data: unknown) => {

    let result = data as Record<string, unknown>;

    for (let i = 0; i < path.length; i++) {
        const name = path[i];

        if (result != null && typeof result === "object" && name in result) {
            result = result[name] as Record<string, unknown>;
            continue;
        }

        throw new Error(ERROR_MESSAGES.PARAM_PATH_NOT_FOUND([paramsName, ...path].join("."), data));
    }

    return result as unknown;
}

/**
 * Applies the paired property's value serializer and (optionally) its schema
 * type converter, matching how literal values are treated at parse time.
 */
const resolvePairedValue = (value: unknown, pairedProperty: PropertyInfo<any> | null, applyConverter: boolean) => {

    if (pairedProperty == null) {
        return value;
    }

    let result = value;

    if (pairedProperty.valueSerializer != null) {
        result = String(pairedProperty.valueSerializer(parseUnknown(result)));
    }

    if (applyConverter) {
        result = converters[pairedProperty.type](result);
    }

    return result;
}

// #endregion

// #region Parser

/**
 * Recursive descent parser over the token stream.  Produces an expression
 * template: literal values are fully resolved, parameter values are represented
 * as ParamReferenceExpression placeholders so the template can be cached and
 * re-bound with different params.
 */
class ExpressionParser {

    private readonly schema: CompiledSchema<any>;
    private readonly stream: TokenStream;
    private readonly entityName: string;
    private readonly paramsName: string | null;
    private readonly params: unknown;

    /** Set when a param value shaped the tree itself (e.g. x[p.name]) — such templates cannot be cached. */
    structurallyDependsOnParams: boolean = false;

    constructor(schema: CompiledSchema<any>, stream: TokenStream, entityName: string, paramsName: string | null, params: unknown) {
        this.schema = schema;
        this.stream = stream;
        this.entityName = entityName;
        this.paramsName = paramsName;
        this.params = params;
    }

    parse(): Expression {
        const expression = this.parseOr();

        if (!this.stream.isAtEnd) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`unexpected token '${this.stream.peek()?.value}'`));
        }

        return expression;
    }

    // || binds loosest, so it sits at the root of the parse
    private parseOr(): Expression {
        let left = this.parseAnd();

        while (this.stream.matchPunctuation("||")) {
            const right = this.parseAnd();
            left = new OperatorExpression({ operator: "||", left, right });
        }

        return left;
    }

    private parseAnd(): Expression {
        let left = this.parseUnary();

        while (this.stream.matchPunctuation("&&")) {
            const right = this.parseUnary();
            left = new OperatorExpression({ operator: "&&", left, right });
        }

        return left;
    }

    private parseUnary(): Expression {
        if (this.stream.matchPunctuation("!")) {
            const expression = this.parseUnary();

            if (expression instanceof ComparatorExpression) {
                expression.negated = !expression.negated;
                return expression;
            }

            throw new Error(ERROR_MESSAGES.UNSUPPORTED("'!' on a compound expression"));
        }

        return this.parseComparison();
    }

    private parseComparison(): Expression {

        // Parenthesized group
        if (this.stream.matchPunctuation("(")) {
            const expression = this.parseOr();
            this.stream.expectPunctuation(")");

            const trailing = this.stream.peek();
            if (trailing != null && trailing.kind === "punctuation" && COMPARISON_OPERATORS[trailing.value] != null) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("comparison against a parenthesized expression"));
            }

            return expression;
        }

        const left = this.parseOperand();
        const operatorToken = this.stream.peek();

        if (operatorToken != null && operatorToken.kind === "punctuation" && COMPARISON_OPERATORS[operatorToken.value] != null) {
            this.stream.next();
            const right = this.parseOperand();
            return this.buildComparison(left, COMPARISON_OPERATORS[operatorToken.value], right);
        }

        return this.buildStandalone(left);
    }

    private parseOperand(): Operand {
        const token = this.stream.peek();

        if (token == null) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("unexpected end of expression"));
        }

        if (token.kind === "string") {
            this.stream.next();
            return this.withValueTransformer({ kind: "value", value: token.value, transformer: null, locale: null });
        }

        if (token.kind === "number") {
            this.stream.next();
            return { kind: "value", value: Number(token.value), transformer: null, locale: null };
        }

        if (token.kind === "punctuation" && token.value === "-") {
            this.stream.next();
            const numberToken = this.stream.next();

            if (numberToken.kind !== "number") {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("unary '-' on a non-number"));
            }

            return { kind: "value", value: -Number(numberToken.value), transformer: null, locale: null };
        }

        if (token.kind === "identifier") {
            return this.parseIdentifierOperand();
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(String(token.value)));
    }

    private parseIdentifierOperand(): Operand {
        const root = this.stream.next().value;

        // Keyword literals
        if (root === "true" || root === "false") {
            return { kind: "value", value: root === "true", transformer: null, locale: null };
        }

        if (root === "null") {
            return { kind: "value", value: null, transformer: null, locale: null };
        }

        if (root === "undefined") {
            return { kind: "value", value: undefined, transformer: null, locale: null };
        }

        if (root === "void") {
            this.stream.next(); // the '0'
            return { kind: "value", value: undefined, transformer: null, locale: null };
        }

        if (root === this.entityName) {
            return this.parseChain({ kind: "property", root });
        }

        if (this.paramsName != null && root === this.paramsName) {
            return this.parseChain({ kind: "param", root });
        }

        // A bare variable from the outer scope — its value cannot be derived from source text
        throw new Error(ERROR_MESSAGES.VARIABLE_VALUE(root));
    }

    /**
     * Parses the segments after an entity/params root: dot access, bracket
     * access, transform methods and comparator methods.
     */
    private parseChain(options: { kind: "property" | "param", root: string }): Operand {
        const path: string[] = [];
        let transformer: Transformer | null = null;
        let locale: string | null = null;

        while (true) {
            if (this.stream.matchPunctuation(".") || this.stream.matchPunctuation("?.")) {
                const segment = this.stream.next();

                if (segment.kind !== "identifier") {
                    throw new Error(ERROR_MESSAGES.UNSUPPORTED(`'.${segment.value}'`));
                }

                // Method call
                if (this.stream.isPunctuation("(")) {
                    const method = segment.value;

                    if (TRANSFORM_METHODS[method] != null) {
                        this.stream.expectPunctuation("(");
                        this.stream.expectPunctuation(")");
                        transformer = TRANSFORM_METHODS[method].transformer;
                        locale = TRANSFORM_METHODS[method].locale;
                        continue;
                    }

                    if (COMPARATOR_METHODS[method] != null) {
                        this.stream.expectPunctuation("(");
                        const argument = this.parseOperand();
                        this.stream.expectPunctuation(")");

                        if (argument.kind === "method-call") {
                            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`nested method call inside .${method}()`));
                        }

                        return {
                            kind: "method-call",
                            target: this.resolveChain(options.kind, path, transformer, locale),
                            method: method as MethodCallOperand["method"],
                            argument
                        };
                    }

                    throw new Error(ERROR_MESSAGES.UNSUPPORTED(`method '.${method}()'`));
                }

                if (transformer != null) {
                    throw new Error(ERROR_MESSAGES.UNSUPPORTED("property access after a transform method"));
                }

                path.push(segment.value);
                continue;
            }

            if (this.stream.matchPunctuation("[")) {
                path.push(this.parseBracketSegment(options.kind));
                this.stream.expectPunctuation("]");
                continue;
            }

            break;
        }

        return this.resolveChain(options.kind, path, transformer, locale);
    }

    private parseBracketSegment(kind: "property" | "param"): string {
        const token = this.stream.next();

        // Literal segment: entity["name"]
        if (token.kind === "string") {
            return token.value;
        }

        // Param-driven segment: entity[p.name] — the property depends on the
        // param VALUE, so the resulting template is tied to these params
        if (kind === "property" && token.kind === "identifier" && this.paramsName != null && token.value === this.paramsName) {
            const paramPath: string[] = [];

            while (this.stream.matchPunctuation(".") || this.stream.matchPunctuation("?.")) {
                paramPath.push(this.stream.next().value);
            }

            const resolved = resolveParamPath(this.paramsName, paramPath, this.params);

            if (typeof resolved !== "string") {
                throw new Error(ERROR_MESSAGES.PROPERTY_NOT_FOUND(paramPath.join(".")));
            }

            this.structurallyDependsOnParams = true;
            return resolved;
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(`bracket access '[${token.value}]'`));
    }

    private resolveChain(kind: "property" | "param", path: string[], transformer: Transformer | null, locale: string | null): PropertyOperand | ParamOperand {

        if (kind === "param") {
            if (path.length === 0) {
                // `params` alone is a variable, not a value we can resolve
                throw new Error(ERROR_MESSAGES.PARAM_PATH_NOT_FOUND(this.paramsName ?? "params", this.params));
            }

            return { kind: "param", path, transformer, locale };
        }

        const pathString = path.join(".");
        const property = this.schema.properties.find(w => w.getAssignmentPath() == pathString);

        if (property == null) {
            throw new Error(ERROR_MESSAGES.PROPERTY_NOT_FOUND(pathString));
        }

        return { kind: "property", property, transformer, locale };
    }

    private withValueTransformer(operand: ValueOperand): ValueOperand {
        if (this.stream.isPunctuation(".")) {
            const method = this.stream.peek(1);

            if (method != null && method.kind === "identifier" && TRANSFORM_METHODS[method.value] != null) {
                this.stream.next(); // .
                this.stream.next(); // method name
                this.stream.expectPunctuation("(");
                this.stream.expectPunctuation(")");

                operand.transformer = TRANSFORM_METHODS[method.value].transformer;
                operand.locale = TRANSFORM_METHODS[method.value].locale;
            }
        }

        return operand;
    }

    // #region Condition building

    private buildComparison(left: Operand, operator: { comparator: Comparator, negated: boolean, strict: boolean }, right: Operand): Expression {

        // methodCall == true/false — fold the boolean into negation
        if (left.kind === "method-call") {
            if (operator.comparator === "equals" && right.kind === "value" && typeof right.value === "boolean") {
                const comparator = this.buildMethodComparator(left);
                const comparedToFalse = right.value === false;
                comparator.negated = comparator.negated !== (operator.negated !== comparedToFalse);
                return comparator;
            }

            throw new Error(ERROR_MESSAGES.UNSUPPORTED("comparing a method call to a non-boolean"));
        }

        if (right.kind === "method-call") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("method call on the right side of a comparison"));
        }

        if (left.kind === "property" && right.kind !== "property") {
            return this.buildPropertyComparator(left, operator, right, /* applyConverter */ true);
        }

        if (right.kind === "property" && left.kind !== "property") {
            const swapped = { ...operator, comparator: SWAPPED_COMPARATORS[operator.comparator] };
            return this.buildPropertyComparator(right, swapped, left, /* applyConverter */ true);
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED("comparison requires a schema property on exactly one side"));
    }

    private buildStandalone(operand: Operand): Expression {

        if (operand.kind === "method-call") {
            return this.buildMethodComparator(operand);
        }

        // Truthy shorthand: `w.isActive` → isActive === true
        if (operand.kind === "property") {
            return this.buildPropertyComparator(operand, COMPARISON_OPERATORS["==="], { kind: "value", value: true, transformer: null, locale: null }, /* applyConverter */ true);
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED("a filter condition must reference a schema property"));
    }

    private buildMethodComparator(operand: MethodCallOperand): ComparatorExpression {
        const { target, method, argument } = operand;

        if (target.kind === "property") {
            if (argument.kind === "property") {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED(`.${method}() comparing two schema properties`));
            }

            // Method arguments skip type conversion — only the value serializer applies
            return this.buildPropertyComparator(target, { comparator: COMPARATOR_METHODS[method], negated: false, strict: false }, argument, /* applyConverter */ false);
        }

        // params.list.includes(entity.property) — membership test with the value on the left
        if (method === "includes" && argument.kind === "property") {
            if (target.transformer != null) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("transform method on a params path used with .includes()"));
            }

            return new ComparatorExpression({
                comparator: "includes",
                negated: false,
                strict: false,
                left: this.createValueExpression(target, argument.property, /* applyConverter */ false),
                right: this.createPropertyExpression(argument)
            });
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(`.${method}() on a params path`));
    }

    private buildPropertyComparator(property: PropertyOperand, operator: { comparator: Comparator, negated: boolean, strict: boolean }, value: ValueOperand | ParamOperand, applyConverter: boolean): ComparatorExpression {

        // Transformers on a property are only meaningful with string-matching
        // comparators; on relational comparators the plugins would silently
        // ignore them and return wrong data
        const isStringMatch = operator.comparator === "starts-with" || operator.comparator === "ends-with" || operator.comparator === "includes";

        if (property.transformer != null && !isStringMatch) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("transform method outside of startsWith/endsWith/includes"));
        }

        return new ComparatorExpression({
            comparator: operator.comparator,
            negated: operator.negated,
            strict: operator.strict,
            left: this.createPropertyExpression(property),
            right: this.createValueExpression(value, property.property, applyConverter)
        });
    }

    private createPropertyExpression(operand: PropertyOperand): PropertyExpression {
        const expression = new PropertyExpression({ property: operand.property });
        expression.transformer = operand.transformer;
        expression.locale = operand.locale;
        return expression;
    }

    private createValueExpression(operand: ValueOperand | ParamOperand, pairedProperty: PropertyInfo<any> | null, applyConverter: boolean): ValueExpression {

        if (operand.kind === "param") {
            const expression = new ParamReferenceExpression({ paramPath: operand.path, pairedProperty, applyConverter });
            expression.transformer = operand.transformer;
            expression.locale = operand.locale;
            return expression;
        }

        const expression = new ValueExpression({ value: resolvePairedValue(operand.value, pairedProperty, applyConverter) });
        expression.transformer = operand.transformer;
        expression.locale = operand.locale;
        return expression;
    }

    // #endregion
}

// #endregion

// #region Template binding

/**
 * Deep-clones a template into a consumer-facing tree, resolving parameter
 * placeholders against the supplied params.  Always clones so cached templates
 * can never be mutated by consumers.
 */
const bindExpression = (expression: Expression, paramsName: string | null, params: unknown): Expression => {

    if (expression instanceof ParamReferenceExpression) {
        const raw = resolveParamPath(paramsName ?? "params", expression.paramPath, params);
        const bound = new ValueExpression({ value: resolvePairedValue(raw, expression.pairedProperty, expression.applyConverter) });
        bound.transformer = expression.transformer;
        bound.locale = expression.locale;
        return bound;
    }

    if (expression instanceof ValueExpression) {
        const clone = new ValueExpression({ value: expression.value });
        clone.transformer = expression.transformer;
        clone.locale = expression.locale;
        return clone;
    }

    if (expression instanceof PropertyExpression) {
        const clone = new PropertyExpression({ property: expression.property });
        clone.transformer = expression.transformer;
        clone.locale = expression.locale;
        return clone;
    }

    if (expression instanceof ComparatorExpression) {
        return new ComparatorExpression({
            comparator: expression.comparator,
            negated: expression.negated,
            strict: expression.strict,
            left: expression.left ? bindExpression(expression.left, paramsName, params) : undefined,
            right: expression.right ? bindExpression(expression.right, paramsName, params) : undefined
        });
    }

    if (expression instanceof OperatorExpression) {
        return new OperatorExpression({
            operator: expression.operator,
            left: expression.left ? bindExpression(expression.left, paramsName, params) : undefined,
            right: expression.right ? bindExpression(expression.right, paramsName, params) : undefined
        });
    }

    return expression;
}

// #endregion

// #region Function source handling

type FunctionShape = {
    entityName: string;
    paramsName: string | null;
    body: string;
}

/**
 * Splits stringified filter source into parameter names and the expression
 * body, unwrapping single-return block bodies.
 */
const resolveFunctionShape = (stringifiedFunction: string, hasParams: boolean): FunctionShape => {

    const arrowIndex = stringifiedFunction.indexOf("=>");

    if (arrowIndex === -1) {
        throw new Error("Invalid Function");
    }

    let parameterNames = stringifiedFunction.substring(0, arrowIndex).trim();
    let body = stringifiedFunction.substring(arrowIndex + 2).trim();

    // Strip wrapping parens: (entity) or ([x, p])
    if (parameterNames.startsWith("(") && parameterNames.endsWith(")")) {
        parameterNames = parameterNames.slice(1, -1).trim();
    }

    let entityName: string;
    let paramsName: string | null = null;

    if (parameterNames.startsWith("[") && parameterNames.endsWith("]")) {
        const destructured = parameterNames.slice(1, -1).split(",").map(w => w.trim());
        entityName = destructured[0];

        if (hasParams) {
            paramsName = destructured[1] ?? null;
        }
    } else {
        entityName = parameterNames;
    }

    if (entityName == null || entityName.length === 0) {
        throw new Error("Invalid Function");
    }

    // Unwrap a single-return block body: { return <expression>; }
    if (body.startsWith("{")) {
        const inner = body.slice(1, body.lastIndexOf("}")).trim();

        if (!inner.startsWith("return")) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("block body without a single return statement"));
        }

        body = inner.slice("return".length).trim();

        if (body.endsWith(";")) {
            body = body.slice(0, -1).trim();
        }
    }

    return { entityName, paramsName, body };
}

// #endregion

// #region Cache

type ParsedTemplate = {
    template: Expression;
    paramsName: string | null;
}

// Keyed by schema instance so identical filter source on different schemas can
// never collide; entries live only as long as the schema does
const templateCache = new WeakMap<CompiledSchema<any>, Map<string, ParsedTemplate>>();
const MAX_CACHED_TEMPLATES_PER_SCHEMA = 1024;

const getCachedTemplate = (schema: CompiledSchema<any>, source: string): ParsedTemplate | null => {
    return templateCache.get(schema)?.get(source) ?? null;
}

const setCachedTemplate = (schema: CompiledSchema<any>, source: string, entry: ParsedTemplate) => {
    let bySource = templateCache.get(schema);

    if (bySource == null) {
        bySource = new Map<string, ParsedTemplate>();
        templateCache.set(schema, bySource);
    }

    // Filter source strings come from static code, so this cap should never be
    // hit in practice — it only guards against unbounded dynamic generation
    if (bySource.size >= MAX_CACHED_TEMPLATES_PER_SCHEMA) {
        bySource.clear();
    }

    bySource.set(source, entry);
}

// #endregion

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
    const stringifiedFunction = fn.toString();

    try {
        const cached = getCachedTemplate(schema, stringifiedFunction);

        if (cached != null) {
            return bindExpression(cached.template, cached.paramsName, params);
        }

        const shape = resolveFunctionShape(stringifiedFunction, params != null);
        const stream = new TokenStream(tokenize(shape.body));
        const parser = new ExpressionParser(schema, stream, shape.entityName, shape.paramsName, params);
        const template = parser.parse();

        // Templates whose structure was resolved from param values are only
        // valid for this exact params object — parse those fresh every time
        if (!parser.structurallyDependsOnParams) {
            setCachedTemplate(schema, stringifiedFunction, { template, paramsName: shape.paramsName });
        }

        return bindExpression(template, shape.paramsName, params);
    } catch (error) {
        logger.warn("Error parsing expression", {
            error,
            collectionName: schema.collectionName,
            params,
            selector: stringifiedFunction
        });
        return Expression.NOT_PARSABLE;
    }
}
