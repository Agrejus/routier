import { logger } from "../utilities";
import { assertString } from "../assertions";
import { CompiledSchema, PropertyInfo, SchemaTypes } from "../schema";
import { evaluate } from "./evaluate";
import { Expression, OperatorExpression, ComparatorExpression, ValueExpression, PropertyExpression, CallExpression, Filter, ParamsFilter, Call, Comparator, Transformer } from "./types";

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

/**
 * A parse failure caused by the params VALUES rather than the filter source.
 * These must never poison the template cache — the same source can succeed
 * with different params.
 */
class ParamDependentParseError extends Error { }

const converters: Record<SchemaTypes, (value: unknown) => unknown> = {
    Array: v => v,
    Boolean: v => v == null ? v : Boolean(v),
    // Stryker disable next-line ArrowFunction: filters on computed properties route to
    // in-memory execution, so this entry cannot be reached through a parsable filter.
    Computed: v => v,
    Date: v => v,
    // A file is a reference, and a filter can legitimately compare its fields — content type
    // and size are ordinary columns. The value passes through unconverted like an object.
    File: v => v,
    // Stryker disable next-line ArrowFunction: SchemaTypes.Definition is handled as a
    // generic primitive everywhere (specs/known-defects.md) and never pairs in a filter.
    Definition: v => v,
    // Stryker disable next-line ArrowFunction: filters on function properties route to
    // in-memory execution, so this entry cannot be reached through a parsable filter.
    Function: v => v,
    Number: v => v == null ? v : Number(v),
    Object: v => v,
    String: v => v == null ? v : String(v),
    // A vector is a list of numbers and passes through like any other array. Nothing
    // converts it because nothing compares it: similarity is `.nearest()`, not a filter.
    Vector: v => v
};

// #region Tokenizer

type TokenKind = "identifier" | "string" | "number" | "bigint" | "regex" | "template" | "punctuation";

type Token = {
    kind: TokenKind;
    value: string;
}

// Longest first so multi-character punctuation wins over its prefixes
const MULTI_CHARACTER_PUNCTUATION = [">>>", "===", "!==", "**", "<<", ">>", "??", "?.", "&&", "||", "==", "!=", ">=", "<=", "=>"] as const;
// Stryker disable next-line all: documented equivalent cluster (see
// docs/mutation-backlog.md) — dropping an entry only affects source the parser rejects
// either way, and the rejection message names the character from the source rather than
// from this set, so no observable boundary distinguishes the mutant. Established
// experimentally: 30 message-asserting tests killed 1 of 12.
const SINGLE_CHARACTER_PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ".", ",", ";", "!", ">", "<", "-", "+", "*", "/", "%", "=", "?", ":", "&", "|", "^", "~"]);

const STRING_ESCAPES: Record<string, string> = {
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "b": "\b",
    "f": "\f",
    "v": "\v",
    "0": "\0"
};

/**
 * Whether a `/` here opens a regex rather than dividing.
 *
 * A regex cannot follow a value. Everything else — the start of the source, an operator, an opening
 * bracket, a comma — is a position where only a regex makes sense.
 */
const regexCanStartHere = (tokens: Token[]): boolean => {
    const previous = tokens[tokens.length - 1];

    if (previous == null) {
        return true;
    }

    if (previous.kind === "number" || previous.kind === "string" || previous.kind === "bigint" || previous.kind === "regex") {
        return false;
    }

    if (previous.kind === "identifier") {
        return false;
    }

    return previous.value !== ")" && previous.value !== "]";
};

const isIdentifierStart = (char: string) => /[a-zA-Z_$]/.test(char);
const isIdentifierPart = (char: string) => /[a-zA-Z0-9_$]/.test(char);
const isDigit = (char: string) => char >= "0" && char <= "9";
const isHexDigit = (char: string) => isDigit(char) || (char >= "a" && char <= "f") || (char >= "A" && char <= "F");

/**
 * Decodes a `\uXXXX`, `\u{...}` or `\xXX` escape starting at the backslash.
 * Returns the decoded character and the index just past the escape.  These
 * escapes carry a computed character, so mapping them through STRING_ESCAPES
 * (which would yield the literal "u"/"x") silently corrupts the value.
 */
const decodeCodeEscape = (source: string, backslashIndex: number): { value: string, nextIndex: number } => {
    const kind = source[backslashIndex + 1];
    let start = backslashIndex + 2;

    if (kind === "u" && source[start] === "{") {
        const end = source.indexOf("}", start + 1);

        if (end === -1) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("unterminated unicode escape"));
        }

        return { value: String.fromCodePoint(parseInt(source.slice(start + 1, end), 16)), nextIndex: end + 1 };
    }

    const length = kind === "u" ? 4 : 2;
    const digits = source.slice(start, start + length);

    if (digits.length < length || [...digits].some(d => !isHexDigit(d))) {
        throw new Error(ERROR_MESSAGES.UNSUPPORTED(`'\\${kind}' escape`));
    }

    return { value: String.fromCharCode(parseInt(digits, 16)), nextIndex: start + length };
}

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

        /**
         * A regex literal, told from division by what came before it.
         *
         * `/` after a value — a number, string, identifier, `)` or `]` — is division. Anywhere else
         * it opens a regex. That is the same rule a JavaScript lexer uses, and it is why `x.a / 2`
         * and `/^a/.test(x.a)` can share a character.
         */
        if (char === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && regexCanStartHere(tokens)) {
            let value = "";
            let inClass = false;
            let j = i + 1;

            while (j < source.length) {
                const current = source[j];

                if (current === "\\") {
                    value += current + (source[j + 1] ?? "");
                    j += 2;
                    continue;
                }

                if (current === "[") {
                    inClass = true;
                } else if (current === "]") {
                    inClass = false;
                } else if (current === "/" && inClass === false) {
                    break;
                } else if (current === "\n") {
                    throw new Error(ERROR_MESSAGES.UNSUPPORTED("unterminated regular expression"));
                }

                value += current;
                j++;
            }

            if (j >= source.length) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("unterminated regular expression"));
            }

            j++;
            let flags = "";

            while (j < source.length && isIdentifierPart(source[j])) {
                flags += source[j];
                j++;
            }

            i = j;
            tokens.push({ kind: "regex", value: `${value}\u0000${flags}` });
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
            const chunks: string[] = [];
            const expressions: string[] = [];
            i++;

            while (i < source.length && source[i] !== quote) {
                if (source[i] === "\\") {
                    const escaped = source[i + 1];

                    if (escaped === "u" || escaped === "x") {
                        const decoded = decodeCodeEscape(source, i);
                        value += decoded.value;
                        i = decoded.nextIndex;
                        continue;
                    }

                    value += STRING_ESCAPES[escaped] ?? escaped;
                    i += 2;
                    continue;
                }

                /**
                 * An interpolation. The literal so far becomes a chunk and the expression source is
                 * kept whole, to be parsed by its own stream — nesting means the inner source can
                 * hold anything, including another template.
                 */
                if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
                    let depth = 1;
                    let expression = "";
                    let at = i + 2;

                    while (at < source.length && depth > 0) {
                        const current = source[at];

                        if (current === "{") {
                            depth++;
                        } else if (current === "}") {
                            depth--;

                            if (depth === 0) {
                                break;
                            }
                        } else if (current === "'" || current === '"' || current === "`") {
                            const closing = current;
                            expression += current;
                            at++;

                            while (at < source.length && source[at] !== closing) {
                                expression += source[at] === "\\" ? source[at] + (source[at + 1] ?? "") : source[at];
                                at += source[at] === "\\" ? 2 : 1;
                            }
                        }

                        expression += source[at];
                        at++;
                    }

                    if (depth > 0) {
                        throw new Error(ERROR_MESSAGES.UNSUPPORTED("unterminated template interpolation"));
                    }

                    chunks.push(value);
                    expressions.push(expression);
                    value = "";
                    i = at + 1;
                    continue;
                }

                value += source[i];
                i++;
            }

            if (i >= source.length) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("unterminated string literal"));
            }

            i++; // consume closing quote

            if (expressions.length > 0) {
                chunks.push(value);
                tokens.push({ kind: "template", value: JSON.stringify({ chunks, expressions }) });
                continue;
            }

            tokens.push({ kind: "string", value });
            continue;
        }

        // Numbers — covers decimals, exponents (1e6), hex/octal/binary (0xFF),
        // and numeric separators (1_000_000).  Values are normalized here (the
        // separator stripped) so the parser can hand them straight to Number()
        if (isDigit(char)) {
            let value = "";

            const nextChar = source[i + 1];
            const radixPrefix = char === "0" && nextChar != null && "xXoObB".includes(nextChar);

            if (radixPrefix) {
                value = source[i] + source[i + 1];
                i += 2;

                while (i < source.length && (isHexDigit(source[i]) || source[i] === "_")) {
                    value += source[i];
                    i++;
                }
            } else {
                while (i < source.length && (isDigit(source[i]) || source[i] === "." || source[i] === "_")) {
                    value += source[i];
                    i++;
                }

                // Exponent part: e/E, optional sign, then digits.  Only consumed when
                // digits follow, so a stray identifier after a number still errors
                if ((source[i] === "e" || source[i] === "E")) {
                    const signLength = source[i + 1] === "+" || source[i + 1] === "-" ? 1 : 0;

                    if (isDigit(source[i + 1 + signLength])) {
                        value += source[i];
                        i++;

                        if (signLength === 1) {
                            value += source[i];
                            i++;
                        }

                        while (i < source.length && isDigit(source[i])) {
                            value += source[i];
                            i++;
                        }
                    }
                }
            }

            if (source[i] === "n") {
                i++;
                tokens.push({ kind: "bigint", value: value.replace(/_/g, "") });
                continue;
            }

            tokens.push({ kind: "number", value: value.replace(/_/g, "") });
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

    private tokens: Token[];
    private index: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    /** Inserts tokens at the cursor, bracketed so they keep their own precedence. */
    splice(tokens: Token[]) {
        const bracketed: Token[] = [
            { kind: "punctuation", value: "(" },
            ...tokens,
            { kind: "punctuation", value: ")" }
        ];

        this.tokens = [...this.tokens.slice(0, this.index), ...bracketed, ...this.tokens.slice(this.index)];
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

    /** The tokens of one statement's value, through the `;` or block end that closes it. */
    takeStatementTokens(): Token[] {
        const tokens: Token[] = [];
        let depth = 0;

        while (!this.isAtEnd) {
            const token = this.peek()!;

            if (token.kind === "punctuation") {
                if (token.value === "(" || token.value === "[" || token.value === "{") {
                    depth++;
                } else if (token.value === ")" || token.value === "]" || token.value === "}") {
                    if (depth === 0) {
                        break;
                    }

                    depth--;
                } else if (token.value === ";" && depth === 0) {
                    this.next();
                    break;
                }
            }

            tokens.push(this.next());
        }

        if (tokens.length === 0) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("a declaration with no value"));
        }

        return tokens;
    }

    isPunctuation(value: string, offset: number = 0): boolean {
        const token = this.peek(offset);
        return token != null && token.kind === "punctuation" && token.value === value;
    }

    /**
     * Whether the group starting here holds a value rather than a condition.
     *
     * `(a && b)` is a boolean sub-expression; `(x.name ?? '') === 'ada'` and `(x.name).length` are
     * values. Only the token after the matching bracket tells them apart, so the decision is made by
     * looking ahead rather than by parsing one way and catching the failure — a rewind on exception
     * would swallow a genuine syntax error inside the group and report it as something else.
     */
    groupIsValue(): boolean {
        let depth = 0;
        let at = this.index;

        for (; at < this.tokens.length; at++) {
            const token = this.tokens[at];

            if (token.kind !== "punctuation") {
                continue;
            }

            if (token.value === "(") {
                depth++;
                continue;
            }

            if (token.value === ")") {
                depth--;

                if (depth === 0) {
                    break;
                }
            }
        }

        const after = this.tokens[at + 1];

        if (after == null || after.kind !== "punctuation") {
            return false;
        }

        return COMPARISON_OPERATORS[after.value] != null || after.value === "." || after.value === "?.";
    }

    /** Whether a `?` sits at the top level of what is left, so this is a conditional. */
    holdsConditional(): boolean {
        let depth = 0;

        for (let at = this.index; at < this.tokens.length; at++) {
            const token = this.tokens[at];

            if (token.kind !== "punctuation") {
                continue;
            }

            if (token.value === "(" || token.value === "[") {
                depth++;
            } else if (token.value === ")" || token.value === "]") {
                depth--;
            } else if (token.value === "?" && depth === 0) {
                return true;
            }
        }

        return false;
    }

    /** Whether the group starting here is `( … ? … : … )` rather than a plain value. */
    groupHoldsConditional(): boolean {
        let depth = 0;

        for (let at = this.index; at < this.tokens.length; at++) {
            const token = this.tokens[at];

            if (token.kind !== "punctuation") {
                continue;
            }

            if (token.value === "(") {
                depth++;
                continue;
            }

            if (token.value === ")") {
                depth--;

                if (depth === 0) {
                    return false;
                }

                continue;
            }

            if (token.value === "?" && depth === 1) {
                return true;
            }
        }

        return false;
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
    target: PropertyOperand | ParamOperand | ValueOperand;
    method: "startsWith" | "endsWith" | "includes";
    argument: PropertyOperand | ValueOperand | ParamOperand;
}

/**
 * Arithmetic, which the tree carries as a binary `CallExpression`.
 *
 * A parse-time shape rather than an expression because the comparator builders orient on operand
 * KIND, and they have to be able to see that the property is in here.
 */
type ArithmeticOperand = {
    kind: "arithmetic";
    call: Call;
    left: Operand;
    right: Operand;
    /** The third operand, which only `conditional` has. */
    extra?: Operand;
    /** Set when brackets around it settled the precedence. See {@link LOOSER_THAN_COMPARISON}. */
    grouped?: true;
}

/**
 * Calls JavaScript binds LOOSER than a comparison.
 *
 * This grammar reads a comparison's operands as values, which puts these tighter than they belong:
 * `x.flags & 6 === 2` is `x.flags & (6 === 2)` in JavaScript and would be read here as
 * `(x.flags & 6) === 2`. The two answer differently, so an ungrouped one is refused rather than
 * reinterpreted — the filter then runs in memory against the caller's own function, which is right by
 * construction. Brackets say which was meant, and JavaScript itself makes an unbracketed `??` mix a
 * syntax error for the same reason.
 */
const LOOSER_THAN_COMPARISON: readonly Call[] = ["bit-and", "bit-or", "bit-xor", "coalesce"];

const needsBrackets = (operand: Operand): boolean =>
    operand.kind === "arithmetic" && operand.grouped !== true && LOOSER_THAN_COMPARISON.includes(operand.call);

/**
 * `a ? b : c`, where the condition is a BOOLEAN and the branches are values.
 *
 * Its own kind rather than an arithmetic operand with three slots, because the condition is an
 * Expression already — a comparison — while the branches are operands still being built.
 */
type ConditionalOperand = {
    kind: "conditional";
    condition: Expression;
    whenTrue: Operand;
    whenFalse: Operand;
}

type Operand = PropertyOperand | ValueOperand | ParamOperand | MethodCallOperand | ArithmeticOperand | ConditionalOperand;

/** JavaScript precedence: `*`, `/`, `%` bind tighter than `+` and `-`. */
const MULTIPLICATIVE_OPERATORS: Record<string, Call> = {
    "*": "multiply",
    "/": "divide",
    "%": "modulo",
};

const ADDITIVE_OPERATORS: Record<string, Call> = {
    "+": "add",
    "-": "subtract",
};

const SHIFT_OPERATORS: Record<string, Call> = {
    "<<": "shift-left",
    ">>": "shift-right",
    ">>>": "shift-right-unsigned",
};

const BITWISE_AND_OPERATORS: Record<string, Call> = { "&": "bit-and" };
const BITWISE_XOR_OPERATORS: Record<string, Call> = { "^": "bit-xor" };
const BITWISE_OR_OPERATORS: Record<string, Call> = { "|": "bit-or" };
const COALESCE_OPERATORS: Record<string, Call> = { "??": "coalesce" };

/** Whether a schema property is reachable in here, which decides which side of a comparison it is. */
const containsProperty = (operand: Operand): boolean => {
    if (operand.kind === "property") {
        return true;
    }

    if (operand.kind === "conditional") {
        // A comparison always names a schema property, so the condition alone settles it
        return true;
    }

    return operand.kind === "arithmetic"
        && (containsProperty(operand.left) || containsProperty(operand.right) || (operand.extra != null && containsProperty(operand.extra)));
};

const DECLARATION_KEYWORDS = new Set(["const", "let", "var"]);

/** An operand whose value only a row can supply. */
const UNKNOWN_UNTIL_ROW = Symbol("unknown until row");

/** The argument slot of a unary call, which every call carries whether or not it takes one. */
const noArgument = (): ValueOperand => ({ kind: "value", value: undefined, transformer: null, locale: null });

/** A predicate no row satisfies. Never reaches a tree: no expression node means "match nothing". */
const NEVER = "never";

type Answer = Expression | typeof NEVER;

const and = (left: Expression, right: Expression): Expression => {
    if (Expression.isEmpty(left)) {
        return right;
    }

    if (Expression.isEmpty(right)) {
        return left;
    }

    return new OperatorExpression({ operator: "&&", left, right });
}

const or = (left: Expression, right: Expression): Expression => {
    if (Expression.isEmpty(left) || Expression.isEmpty(right)) {
        return Expression.EMPTY;
    }

    return new OperatorExpression({ operator: "||", left, right });
}

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

        throw new ParamDependentParseError(ERROR_MESSAGES.PARAM_PATH_NOT_FOUND([paramsName, ...path].join("."), data));
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
    private readonly scope: Scope;
    private readonly paramsName: string | null;
    private readonly params: unknown;

    /** Set when a param value shaped the tree itself (e.g. x[p.name]) — such templates cannot be cached. */
    structurallyDependsOnParams: boolean = false;

    constructor(schema: CompiledSchema<any>, stream: TokenStream, scope: Scope, paramsName: string | null, params: unknown) {
        this.schema = schema;
        this.stream = stream;
        this.scope = scope;
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

    parseBody(): Expression {

        if (!this.stream.isPunctuation("{")) {
            return this.parse();
        }

        const answer = this.parseBlock();

        if (!this.stream.isAtEnd) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`unexpected token '${this.stream.peek()?.value}'`));
        }

        if (answer === NEVER) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("a predicate no row can satisfy"));
        }

        return answer;
    }

    /** The expression a `{ … }` block answers with. */
    private parseBlock(): Answer {
        this.stream.expectPunctuation("{");
        const answer = this.parseStatements();
        this.stream.expectPunctuation("}");

        return answer;
    }

    /** Statements up to the one that returns. What follows a `return` is never read, as in JavaScript. */
    private parseStatements(): Answer {
        if (this.stream.isPunctuation("}") || this.stream.isAtEnd) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("a block body that returns nothing"));
        }

        const keyword = this.stream.peek();

        if (keyword == null || keyword.kind !== "identifier") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`a statement starting '${keyword?.value}'`));
        }

        if (DECLARATION_KEYWORDS.has(keyword.value)) {
            this.declare();
            return this.parseStatements();
        }

        if (keyword.value === "return") {
            this.stream.next();
            const answer = this.parseReturnedCondition();
            this.stream.matchPunctuation(";");

            return answer;
        }

        if (keyword.value === "if") {
            return this.parseIfStatement();
        }

        if (keyword.value === "switch") {
            return this.parseSwitchStatement();
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(`the statement '${keyword.value}'`));
    }

    /**
     * Binds a `const`/`let`/`var` name to the tokens of its initializer — tokens rather than a parsed
     * expression, so the name works as an operand, an argument, or a call receiver alike.
     */
    private declare() {
        this.stream.next();

        const name = this.stream.next();

        if (name.kind !== "identifier") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`the declaration '${name.value}'`));
        }

        this.stream.expectPunctuation("=");

        this.scope.set(name.value, { kind: "inlined", tokens: this.stream.takeStatementTokens() });
    }

    /** `return false` on its own, which no row satisfies, and every other returned condition. */
    private parseReturnedCondition(): Answer {
        const next = this.stream.peek();
        const after = this.stream.peek(1);
        const endsHere = after == null || (after.kind === "punctuation" && (after.value === ";" || after.value === "}"));

        if (next != null && next.kind === "identifier" && next.value === "false" && endsHere) {
            this.stream.next();
            return NEVER;
        }

        return this.parseOr();
    }

    private parseIfStatement(): Answer {
        this.stream.next();

        this.stream.expectPunctuation("(");
        const condition = this.parseOr();
        this.stream.expectPunctuation(")");

        const whenTrue = this.parseBranch();

        if (this.stream.peek()?.value === "else") {
            this.stream.next();
            return this.either(condition, whenTrue, this.parseBranch());
        }

        // Without an `else`, the statements after the `if` are the other branch
        return this.either(condition, whenTrue, this.parseStatements());
    }

    /** One arm of an `if`: a block, or a single statement. */
    private parseBranch(): Answer {
        return this.stream.isPunctuation("{") ? this.parseBlock() : this.parseStatements();
    }

    /** A `switch` over one subject, as the disjunction of its cases. */
    private parseSwitchStatement(): Answer {
        this.stream.next();

        this.stream.expectPunctuation("(");
        const subject = this.parseValue();
        this.stream.expectPunctuation(")");
        this.stream.expectPunctuation("{");

        let matching: Expression | null = null;
        let pending: Expression[] = [];
        let everyLabel: Expression[] = [];
        let byDefault: Expression | null = null;
        let anyCaseBroke = false;

        while (!this.stream.matchPunctuation("}")) {
            const label = this.stream.next();

            if (label.kind !== "identifier" || (label.value !== "case" && label.value !== "default")) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED(`'${label.value}' inside a switch`));
            }

            if (label.value === "case") {
                const test = this.buildComparison(subject, COMPARISON_OPERATORS["==="], this.parseValue());
                pending.push(test);
                everyLabel.push(test);
            }

            this.stream.expectPunctuation(":");

            // `case 'a':` with no body of its own runs the next case's body
            if (this.stream.peek()?.value === "case" || this.stream.peek()?.value === "default") {
                continue;
            }

            if (this.stream.peek()?.value === "break") {
                this.stream.next();
                this.stream.matchPunctuation(";");
                anyCaseBroke = true;
                pending = [];
                continue;
            }

            const body = this.parseCaseBody();

            if (label.value === "default") {
                byDefault = body === NEVER ? null : body;
                continue;
            }

            if (body !== NEVER && pending.length > 0) {
                const reached = pending.reduce((left, right) => or(left, right));
                const term = Expression.isEmpty(body) ? reached : and(reached, body);

                matching = matching == null ? term : or(matching, term);
            }

            pending = [];
        }

        // Falling out of the switch continues after it, so the statements there are the default too
        const afterSwitch = byDefault == null && !this.stream.isPunctuation("}") && !this.stream.isAtEnd
            ? this.parseStatements()
            : NEVER;

        if (afterSwitch !== NEVER) {
            // A `break` also continues after the switch, so its case would take that answer rather
            // than none — a distinction this rewrite cannot carry
            if (anyCaseBroke) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("a switch that breaks and then falls into more statements"));
            }

            byDefault = afterSwitch;
        }

        // A `default` runs only when every case failed, wherever it was written
        if (byDefault != null) {
            const noCaseMatched = everyLabel.length === 0
                ? byDefault
                : and(this.negateExpression(everyLabel.reduce((left, right) => or(left, right))), byDefault);

            matching = matching == null ? noCaseMatched : or(matching, noCaseMatched);
        }

        return matching ?? NEVER;
    }

    /** One case body, and the `break` that may follow its `return`. */
    private parseCaseBody(): Answer {
        const answer = this.parseStatements();

        if (this.stream.peek()?.value === "break") {
            this.stream.next();
            this.stream.matchPunctuation(";");
        }

        return answer;
    }

    /**
     * The predicate an `if`/`else` answers: `(condition && whenTrue) || (!condition && whenFalse)`,
     * with each case below that form after a constant branch cancels out.
     */
    private either(condition: Expression, whenTrue: Answer, whenFalse: Answer): Answer {

        if (whenTrue === NEVER) {
            return whenFalse === NEVER ? NEVER : and(this.negateExpression(condition), whenFalse);
        }

        if (whenFalse === NEVER) {
            return and(condition, whenTrue);
        }

        if (Expression.isEmpty(whenTrue)) {
            return or(condition, whenFalse);
        }

        if (Expression.isEmpty(whenFalse)) {
            return or(this.negateExpression(condition), whenTrue);
        }

        return or(and(condition, whenTrue), and(this.negateExpression(condition), whenFalse));
    }

    // || binds loosest, so it sits at the root of the parse
    private parseOr(): Expression {
        let left = this.parseAnd();

        while (this.stream.matchPunctuation("||")) {
            const right = this.parseAnd();

            // A tautology (`true`) absorbs the whole disjunction
            if (Expression.isEmpty(left) || Expression.isEmpty(right)) {
                left = Expression.EMPTY;
                continue;
            }

            left = new OperatorExpression({ operator: "||", left, right });
        }

        return left;
    }

    private parseAnd(): Expression {
        let left = this.parseUnary();

        while (this.stream.matchPunctuation("&&")) {
            const right = this.parseUnary();

            // A tautology (`true`) is the identity of a conjunction
            if (Expression.isEmpty(left)) {
                left = right;
                continue;
            }

            if (Expression.isEmpty(right)) {
                continue;
            }

            left = new OperatorExpression({ operator: "&&", left, right });
        }

        return left;
    }

    private parseUnary(): Expression {
        if (this.stream.matchPunctuation("!")) {
            return this.negateExpression(this.parseUnary());
        }

        return this.parseComparison();
    }

    /**
     * Applies `!` to an already-parsed expression: comparators flip their
     * negated flag, compound expressions distribute via De Morgan's laws.
     *
     * Builds a new tree rather than flipping the flag in place, because an `if` uses its condition
     * twice — once negated — and a shared node would carry the flip into both branches.
     */
    private negateExpression(expression: Expression): Expression {
        if (expression instanceof ComparatorExpression) {
            return new ComparatorExpression({
                comparator: expression.comparator,
                negated: !expression.negated,
                strict: expression.strict,
                left: expression.left,
                right: expression.right
            });
        }

        if (expression instanceof OperatorExpression && expression.left != null && expression.right != null) {
            return new OperatorExpression({
                operator: expression.operator === "&&" ? "||" : "&&",
                left: this.negateExpression(expression.left),
                right: this.negateExpression(expression.right)
            });
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED("'!' on this expression"));
    }

    private parseComparison(): Expression {

        /**
         * A parenthesised group is either a boolean sub-expression or a VALUE — `(a && b)` against
         * `(x.name ?? '') === 'ada'` — and which one it is is only known at the closing bracket, by
         * what follows. So the boolean reading is tried first and rewound if a comparator turns up.
         */
        if (this.stream.isPunctuation("(") && this.stream.groupIsValue() === false) {
            this.stream.next();

            const expression = this.parseOr();
            this.stream.expectPunctuation(")");

            return expression;
        }

        const left = this.parseValue();
        const operatorToken = this.stream.peek();

        if (operatorToken != null && operatorToken.kind === "punctuation" && COMPARISON_OPERATORS[operatorToken.value] != null) {
            this.stream.next();
            const right = this.parseValue();
            return this.buildComparison(left, COMPARISON_OPERATORS[operatorToken.value], right);
        }

        return this.buildStandalone(left);
    }

    /**
     * A value, at JavaScript's precedence.
     *
     * Lowest first: the conditional operator, then nullish coalescing, then the bitwise levels, then
     * the shifts, then the arithmetic. Comparison sits between the shifts and the bitwise levels in
     * JavaScript, but a comparison is a boolean and is handled by `parseComparison` above, so this
     * chain skips it — a bitwise operand here is always a value.
     */
    /**
     * An operand from its own source, sharing this parser's schema and parameter names.
     *
     * A structural dependence found inside propagates outward: the template it belongs to cannot be
     * cached either.
     */
    private parseNested(source: string): Operand {
        const nested = new ExpressionParser(this.schema, new TokenStream(tokenize(source)), this.scope, this.paramsName, this.params);
        const operand = nested.parseInterpolation();

        // Leftover tokens mean the interpolation held something this reads only part of. Silently
        // keeping the part it understood is the worst outcome available: `${x.age > 5 ? "a" : "b"}`
        // would become `x.age`, and the filter would answer a question nobody asked.
        if (nested.stream.isAtEnd === false) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("an interpolation this parser reads only part of"));
        }

        if (nested.structurallyDependsOnParams === true) {
            this.structurallyDependsOnParams = true;
        }

        return operand;
    }

    /**
     * The whole of one `${…}`.
     *
     * A conditional is read here rather than in `parseValue`, because an interpolation is the one
     * place a conditional appears without brackets around it.
     */
    parseInterpolation(): Operand {

        if (this.stream.holdsConditional()) {
            const condition = this.parseOr();

            this.stream.expectPunctuation("?");
            const whenTrue = this.parseValue();
            this.stream.expectPunctuation(":");
            const whenFalse = this.parseValue();

            return { kind: "conditional", condition, whenTrue, whenFalse };
        }

        return this.parseValue();
    }

    parseValue(): Operand {
        return this.parseCoalesce();
    }

    private parseCoalesce(): Operand {
        return this.parseBinary(COALESCE_OPERATORS, () => this.parseBitwiseOr());
    }

    private parseBitwiseOr(): Operand {
        return this.parseBinary(BITWISE_OR_OPERATORS, () => this.parseBitwiseXor());
    }

    private parseBitwiseXor(): Operand {
        return this.parseBinary(BITWISE_XOR_OPERATORS, () => this.parseBitwiseAnd());
    }

    private parseBitwiseAnd(): Operand {
        return this.parseBinary(BITWISE_AND_OPERATORS, () => this.parseShift());
    }

    private parseShift(): Operand {
        return this.parseBinary(SHIFT_OPERATORS, () => this.parseAdditive());
    }

    private parseAdditive(): Operand {
        return this.parseBinary(ADDITIVE_OPERATORS, () => this.parseMultiplicative());
    }

    private parseMultiplicative(): Operand {
        return this.parseBinary(MULTIPLICATIVE_OPERATORS, () => this.parseExponent());
    }

    /** `**` is RIGHT-associative: `2 ** 3 ** 2` is 2 ** 9, not 8 ** 2. */
    private parseExponent(): Operand {
        const left = this.parseOperand();

        if (this.stream.isPunctuation("**") === false) {
            return left;
        }

        this.stream.next();

        return { kind: "arithmetic", call: "power", left, right: this.parseExponent() };
    }

    /** Left-associative, so `a - b - c` is `(a - b) - c` rather than `a - (b - c)`. */
    private parseBinary(operators: Record<string, Call>, next: () => Operand): Operand {
        let left = next();

        for (;;) {
            const token = this.stream.peek();

            if (token == null || token.kind !== "punctuation" || operators[token.value] == null) {
                return left;
            }

            this.stream.next();
            left = { kind: "arithmetic", call: operators[token.value], left, right: next() };
        }
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

        // A parenthesised VALUE — `(x.price & 1)`, `(x.name ?? '')`. The boolean reading of a group
        // is handled in parseComparison; by the time an operand sees one it is arithmetic.
        if (token.kind === "punctuation" && token.value === "(") {
            const conditional = this.stream.groupHoldsConditional();

            this.stream.next();

            if (conditional === true) {
                const condition = this.parseOr();

                this.stream.expectPunctuation("?");
                const whenTrue = this.parseValue();
                this.stream.expectPunctuation(":");
                const whenFalse = this.parseValue();
                this.stream.expectPunctuation(")");

                return { kind: "conditional", condition, whenTrue, whenFalse };
            }

            const inner = this.parseValue();
            this.stream.expectPunctuation(")");

            const grouped = inner.kind === "arithmetic" ? { ...inner, grouped: true } as Operand : inner;

            return this.withGroupCall(grouped);
        }

        /**
         * A template with interpolation, folded into `concat`.
         *
         * Each `${…}` was kept as source by the tokenizer and is parsed by its own stream, so it can
         * hold anything an operand can — a property, a param, arithmetic, another template. Empty
         * chunks are dropped: `${a}${b}` is two operands, not two operands and three empty strings.
         */
        if (token.kind === "template") {
            this.stream.next();

            const { chunks, expressions } = JSON.parse(token.value) as { chunks: string[], expressions: string[] };
            const pieces: Operand[] = [];

            for (let at = 0; at < chunks.length; at++) {
                if (chunks[at].length > 0) {
                    pieces.push({ kind: "value", value: chunks[at], transformer: null, locale: null });
                }

                if (at < expressions.length) {
                    pieces.push(this.parseNested(expressions[at]));
                }
            }

            if (pieces.length === 0) {
                return { kind: "value", value: "", transformer: null, locale: null };
            }

            // One piece and no chunk means no concat to do the coercion, so the conversion has to be
            // explicit: `` `${x.age}` `` is the STRING "9", not the number 9.
            if (pieces.length === 1) {
                const only = pieces[0];
                const alreadyText = only.kind === "value" && typeof only.value === "string";

                return alreadyText ? only : { kind: "arithmetic", call: "to-string", left: only, right: { kind: "value", value: undefined, transformer: null, locale: null } };
            }

            return pieces.reduce((left, right) => ({ kind: "arithmetic", call: "concat", left, right }));
        }

        if (token.kind === "bigint") {
            this.stream.next();
            return { kind: "value", value: BigInt(token.value), transformer: null, locale: null };
        }

        if (token.kind === "regex") {
            this.stream.next();

            const [source, flags] = token.value.split("\u0000");
            const pattern: ValueOperand = { kind: "value", value: new RegExp(source, flags), transformer: null, locale: null };

            // `/^a/.test(x.name)` — the pattern is the literal, the subject is the argument, and the
            // tree puts them the other way round: the property is what the call applies to.
            if (this.stream.isPunctuation(".")) {
                const method = this.stream.peek(1);

                if (method != null && method.kind === "identifier" && method.value === "test") {
                    this.stream.next();
                    this.stream.next();
                    this.stream.expectPunctuation("(");

                    const subject = this.parseValue();
                    this.stream.expectPunctuation(")");

                    return { kind: "arithmetic", call: "matches", left: subject, right: pattern };
                }
            }

            return pattern;
        }

        if (token.kind === "punctuation" && token.value === "~") {
            this.stream.next();

            // Unary, so the tree carries the operand and no argument
            return { kind: "arithmetic", call: "bit-not", left: this.parseOperand(), right: { kind: "value", value: undefined, transformer: null, locale: null } };
        }

        if (token.kind === "punctuation" && token.value === "-") {
            this.stream.next();
            const numberToken = this.stream.next();

            if (numberToken.kind !== "number") {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("unary '-' on a non-number"));
            }

            return { kind: "value", value: -Number(numberToken.value), transformer: null, locale: null };
        }

        if (token.kind === "punctuation" && token.value === "[") {
            return this.parseArrayLiteralOperand();
        }

        if (token.kind === "identifier") {
            return this.parseIdentifierOperand();
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(String(token.value)));
    }

    /**
     * Parses an inline array of literals, e.g. `["active", "pending"]`, and the
     * membership test that follows it: `[...].includes(entity.property)`.
     */
    private parseArrayLiteralOperand(): Operand {
        this.stream.expectPunctuation("[");
        const elements: unknown[] = [];

        while (!this.stream.isPunctuation("]")) {
            const element = this.parseOperand();

            if (element.kind !== "value" || element.transformer != null) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("a non-literal element in an array literal"));
            }

            elements.push(element.value);

            if (!this.stream.matchPunctuation(",")) {
                break;
            }
        }

        this.stream.expectPunctuation("]");

        const array: ValueOperand = { kind: "value", value: elements, transformer: null, locale: null };

        // The only supported use is a membership test on a schema property
        if (this.stream.isPunctuation(".") || this.stream.isPunctuation("?.")) {
            this.stream.next();
            const method = this.stream.next();

            if (method.kind !== "identifier" || method.value !== "includes") {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED(`'.${method.value}' on an array literal`));
            }

            this.stream.expectPunctuation("(");
            const argument = this.parseOperand();
            this.stream.expectPunctuation(")");

            if (argument.kind === "method-call") {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("nested method call inside .includes()"));
            }

            if (argument.kind === "arithmetic" || argument.kind === "conditional") {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("arithmetic inside .includes()"));
            }

            return { kind: "method-call", target: array, method: "includes", argument };
        }

        return array;
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

        const binding = this.scope.get(root);

        if (binding != null) {
            if (binding.kind === "inlined") {
                this.stream.splice(binding.tokens);
                return this.parseOperand();
            }

            return this.parseChain({ kind: binding.kind, path: [...binding.path] });
        }

        // A bare variable from the outer scope — its value cannot be derived from source text
        throw new Error(ERROR_MESSAGES.VARIABLE_VALUE(root));
    }

    /**
     * Parses the segments after an entity/params root: dot access, bracket
     * access, transform methods and comparator methods.
     */
    private parseChain(options: { kind: "property" | "param", path: string[] }): Operand {
        const path = options.path;
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

                        if (argument.kind === "arithmetic" || argument.kind === "conditional") {
                            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`arithmetic inside .${method}()`));
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
        // param VALUE, so the resulting template is tied to these params.
        // Stryker disable next-line all: documented equivalent cluster (see
        // docs/mutation-backlog.md) — every mutation of this four-conjunct guard reroutes
        // bracket access between two paths that both collapse to NOT_PARSABLE; the
        // experiment recorded there aimed 30 tests at this line and killed none.
        const binding = token.kind === "identifier" ? this.scope.get(token.value) : undefined;

        if (kind === "property" && binding != null && binding.kind === "param") {
            const paramPath: string[] = [...binding.path];

            while (this.stream.matchPunctuation(".") || this.stream.matchPunctuation("?.")) {
                paramPath.push(this.stream.next().value);
            }

            const resolved = resolveParamPath(this.paramsName ?? token.value, paramPath, this.params);

            if (typeof resolved !== "string") {
                throw new ParamDependentParseError(ERROR_MESSAGES.PROPERTY_NOT_FOUND(paramPath.join(".")));
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
            // `.length` on a string/array property — a real schema property named
            // `length` wins (checked above); otherwise treat it as a transformer
            if (path.length > 1 && path[path.length - 1] === "length" && transformer == null) {
                const parentPath = path.slice(0, -1).join(".");
                const parent = this.schema.properties.find(w => w.getAssignmentPath() == parentPath);

                // Vector is deliberately absent. Its length is the dimension count declared
                // in the schema — a constant, not data — so a filter on it answers a question
                // nobody asks, and pushing it down would need `json_array_length` on a
                // backend storing JSON and something else entirely on one with a native
                // vector column. Not parsing it leaves a clear error instead of a dialect gap.
                if (parent != null && (parent.type === SchemaTypes.String || parent.type === SchemaTypes.Array)) {
                    return { kind: "property", property: parent, transformer: "length", locale: null };
                }
            }

            throw new Error(ERROR_MESSAGES.PROPERTY_NOT_FOUND(pathString));
        }

        return { kind: "property", property, transformer, locale };
    }

    /**
     * A call on a parenthesised value: `(x.name).toLowerCase()`, `(x.age + 1).length`. Any operand can
     * receive one here, unlike a property chain, which carries at most one transform.
     */
    private withGroupCall(operand: Operand): Operand {
        let receiver = operand;

        while (this.stream.isPunctuation(".") || this.stream.isPunctuation("?.")) {
            const segment = this.stream.peek(1);

            if (segment == null || segment.kind !== "identifier") {
                break;
            }

            if (segment.value === "length" && !this.stream.isPunctuation("(", 2)) {
                this.stream.next();
                this.stream.next();

                receiver = { kind: "arithmetic", call: "length", left: receiver, right: noArgument() };
                continue;
            }

            const transform = TRANSFORM_METHODS[segment.value];

            if (transform != null) {
                this.stream.next();
                this.stream.next();
                this.stream.expectPunctuation("(");
                this.stream.expectPunctuation(")");

                receiver = {
                    kind: "arithmetic",
                    call: transform.transformer,
                    left: receiver,
                    right: transform.locale == null ? noArgument() : { kind: "value", value: transform.locale, transformer: null, locale: null }
                };
                continue;
            }

            // A comparator method needs a property target, which only an ungrouped chain produces
            if (COMPARATOR_METHODS[segment.value] != null && receiver.kind === "property") {
                this.stream.next();
                this.stream.next();
                this.stream.expectPunctuation("(");
                const argument = this.parseOperand();
                this.stream.expectPunctuation(")");

                if (argument.kind !== "property" && argument.kind !== "value" && argument.kind !== "param") {
                    throw new Error(ERROR_MESSAGES.UNSUPPORTED(`'.${segment.value}()' on that argument`));
                }

                return { kind: "method-call", target: receiver, method: segment.value as MethodCallOperand["method"], argument };
            }

            break;
        }

        return receiver;
    }

    private withValueTransformer(operand: ValueOperand): ValueOperand {
        if (this.stream.isPunctuation(".")) {
            const method = this.stream.peek(1);

            // Stryker disable next-line all: documented equivalent cluster (see
        // docs/mutation-backlog.md) — the guard's conjuncts each route to a rejection that
        // collapses to NOT_PARSABLE with an indistinguishable message; 18 targeted tests
        // killed none of these.
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

        if (needsBrackets(left) || needsBrackets(right)) {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(
                "a bitwise or nullish operator compared without brackets, which JavaScript reads the other way round"
            ));
        }

        if (left.kind === "arithmetic" || right.kind === "arithmetic" || left.kind === "conditional" || right.kind === "conditional") {
            if (containsProperty(left) === false && containsProperty(right) === false) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("arithmetic that references no schema property"));
            }

            return new ComparatorExpression({
                comparator: operator.comparator,
                negated: operator.negated,
                strict: operator.strict,
                left: this.createOperandExpression(left),
                right: this.createOperandExpression(right)
            });
        }

        if (left.kind === "property" && right.kind === "property") {
            return new ComparatorExpression({
                comparator: operator.comparator,
                negated: operator.negated,
                strict: operator.strict,
                left: this.createPropertyExpression(left),
                right: this.createPropertyExpression(right)
            });
        }

        if (left.kind === "property" && right.kind !== "property") {
            return this.buildPropertyComparator(left, operator, right, /* applyConverter */ true);
        }

        if (right.kind === "property" && left.kind !== "property") {
            const swapped = { ...operator, comparator: SWAPPED_COMPARATORS[operator.comparator] };
            return this.buildPropertyComparator(right, swapped, left, /* applyConverter */ true);
        }

        const settled = this.settleConstantComparison(left, operator, right);

        if (settled != null) {
            return settled;
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED("comparison requires a schema property on at least one side"));
    }

    /**
     * The answer a comparison of two constants gives, when that answer is `true`. The other answer
     * excludes every row, which has no expression node.
     */
    private settleConstantComparison(left: Operand, operator: { comparator: Comparator, negated: boolean, strict: boolean }, right: Operand): Expression | null {
        const leftValue = this.constantOf(left);
        const rightValue = this.constantOf(right);

        if (leftValue === UNKNOWN_UNTIL_ROW || rightValue === UNKNOWN_UNTIL_ROW) {
            return null;
        }

        const answer = evaluate(new ComparatorExpression({
            comparator: operator.comparator,
            negated: operator.negated,
            strict: operator.strict,
            left: new ValueExpression({ value: leftValue }),
            right: new ValueExpression({ value: rightValue })
        }), {});

        if (answer === true) {
            return Expression.EMPTY;
        }

        // Params decided this, so the refusal must not be cached against the source: the same filter
        // with other params can be a tautology.
        if (left.kind === "param" || right.kind === "param") {
            throw new ParamDependentParseError(ERROR_MESSAGES.UNSUPPORTED("a params comparison no row satisfies"));
        }

        return null;
    }

    /** The value an operand holds already, for the operands that do not depend on a row. */
    private constantOf(operand: Operand): unknown {
        if (operand.kind === "value" && operand.transformer == null) {
            return operand.value;
        }

        if (operand.kind === "param" && operand.transformer == null) {
            this.structurallyDependsOnParams = true;
            return resolveParamPath(this.paramsName ?? "params", operand.path, this.params);
        }

        return UNKNOWN_UNTIL_ROW;
    }

    private buildStandalone(operand: Operand): Expression {

        if (operand.kind === "method-call") {
            return this.buildMethodComparator(operand);
        }

        if (operand.kind === "property") {
            // Truthy shorthand on `.length`: a length is truthy exactly when > 0
            if (operand.transformer === "length") {
                return this.buildPropertyComparator(operand, COMPARISON_OPERATORS[">"], { kind: "value", value: 0, transformer: null, locale: null }, /* applyConverter */ true);
            }

            // Truthy shorthand: `w.isActive` → isActive === true
            return this.buildPropertyComparator(operand, COMPARISON_OPERATORS["==="], { kind: "value", value: true, transformer: null, locale: null }, /* applyConverter */ true);
        }

        // A boolean-valued call standing alone IS the predicate
        if (operand.kind === "arithmetic" && operand.call === "matches") {
            return new ComparatorExpression({
                comparator: "equals",
                negated: false,
                strict: false,
                left: this.createOperandExpression(operand),
                right: new ValueExpression({ value: true })
            });
        }

        if (operand.kind === "arithmetic" || operand.kind === "conditional") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("arithmetic used as a condition rather than compared"));
        }

        // Constant `true` — a tautology, which parseAnd/parseOr simplify away
        if (operand.kind === "value" && operand.value === true && operand.transformer == null) {
            return Expression.EMPTY;
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

        // ["a", "b"].includes(x.prop) / params.list.includes(x.prop) —
        // membership test with the collection on the left
        if (method === "includes" && argument.kind === "property") {
            if (target.transformer != null) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("transform method on a collection used with .includes()"));
            }

            return new ComparatorExpression({
                comparator: "includes",
                negated: false,
                strict: false,
                left: this.createValueExpression(target, argument.property, /* applyConverter */ false),
                right: this.createPropertyExpression(argument)
            });
        }

        throw new Error(ERROR_MESSAGES.UNSUPPORTED(`.${method}() on a non-property target`));
    }

    private buildPropertyComparator(property: PropertyOperand, operator: { comparator: Comparator, negated: boolean, strict: boolean }, value: ValueOperand | ParamOperand, applyConverter: boolean): ComparatorExpression {

        const isStringMatch = operator.comparator === "starts-with" || operator.comparator === "ends-with" || operator.comparator === "includes";

        // `.length` compares a NUMBER, so the paired property's serializer and
        // type converter must not touch the value; and a length has no meaning
        // inside a string-matching comparator
        if (property.transformer === "length") {
            if (isStringMatch) {
                throw new Error(ERROR_MESSAGES.UNSUPPORTED("'.length' with startsWith/endsWith/includes"));
            }

            return new ComparatorExpression({
                comparator: operator.comparator,
                negated: operator.negated,
                strict: operator.strict,
                left: this.createPropertyExpression(property),
                right: this.createValueExpression(value, null, /* applyConverter */ false)
            });
        }

        return new ComparatorExpression({
            comparator: operator.comparator,
            negated: operator.negated,
            strict: operator.strict,
            left: this.createPropertyExpression(property),
            right: this.createValueExpression(value, property.property, applyConverter)
        });
    }

    /**
     * Any operand as an expression.
     *
     * Values inside arithmetic take no paired property: the result is a computed number, so the
     * property's serializer and type converter do not describe it — the same reason `.length` skips
     * them.
     */
    private createOperandExpression(operand: Operand): Expression {

        if (operand.kind === "conditional") {
            return new CallExpression({
                call: "conditional",
                expression: operand.condition,
                arguments: [this.createOperandExpression(operand.whenTrue), this.createOperandExpression(operand.whenFalse)]
            });
        }

        if (operand.kind === "arithmetic") {
            return new CallExpression({
                call: operand.call,
                expression: this.createOperandExpression(operand.left),
                arguments: operand.extra == null
                    ? [this.createOperandExpression(operand.right)]
                    : [this.createOperandExpression(operand.right), this.createOperandExpression(operand.extra)]
            });
        }

        if (operand.kind === "property") {
            return this.createPropertyExpression(operand);
        }

        if (operand.kind === "method-call") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED("a method call inside arithmetic"));
        }

        return this.createValueExpression(operand, null, /* applyConverter */ false);
    }

    private createPropertyExpression(operand: PropertyOperand): Expression {
        return asCall(new PropertyExpression({ property: operand.property }), operand.transformer, operand.locale);
    }

    private createValueExpression(operand: ValueOperand | ParamOperand, pairedProperty: PropertyInfo<any> | null, applyConverter: boolean): Expression {

        if (operand.kind === "param") {
            return asCall(
                new ParamReferenceExpression({ paramPath: operand.path, pairedProperty, applyConverter }),
                operand.transformer,
                operand.locale
            );
        }

        const expression = new ValueExpression({ value: resolvePairedValue(operand.value, pairedProperty, applyConverter) });

        return asCall(expression, operand.transformer, operand.locale);
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

        return new ValueExpression({ value: resolvePairedValue(raw, expression.pairedProperty, expression.applyConverter) });
    }

    if (expression instanceof ValueExpression) {
        return new ValueExpression({ value: expression.value });
    }

    if (expression instanceof PropertyExpression) {
        return new PropertyExpression({ property: expression.property });
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

    if (expression instanceof CallExpression) {
        return new CallExpression({
            call: expression.call,
            expression: bindExpression(expression.expression, paramsName, params),
            arguments: expression.arguments.map(argument => bindExpression(argument, paramsName, params)),
        });
    }

    return expression;
}

/**
 * Wraps an operand in the call a transform method named, if there was one.
 *
 * `Transformer` and `Call` share these three names, so the transform IS the call name. A locale
 * becomes the call's first argument, which is where it belongs — it qualifies the casing, not the
 * property.
 */
const asCall = (inner: Expression, transformer: Transformer | null, locale: string | null): Expression => {

    if (transformer == null) {
        return inner;
    }

    return new CallExpression({
        call: transformer,
        expression: inner,
        arguments: locale == null ? [] : [new ValueExpression({ value: locale })],
    });
};

// #endregion

// #region Function source handling

/** What an identifier in a filter body stands for. */
type Binding =
    | { kind: "property", path: string[] }
    | { kind: "param", path: string[] }
    | { kind: "inlined", tokens: Token[] };

type Scope = Map<string, Binding>;

type FunctionShape = {
    scope: Scope;
    paramsName: string | null;
    body: string;
}

/** Binds every name a destructuring pattern introduces to the path it reads. */
const bindPattern = (stream: TokenStream, kind: "property" | "param", path: string[], scope: Scope): void => {

    if (!stream.matchPunctuation("{")) {
        const name = stream.next();

        if (name.kind !== "identifier") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`parameter '${name.value}'`));
        }

        scope.set(name.value, { kind, path });
        return;
    }

    while (!stream.matchPunctuation("}")) {
        const key = stream.next();

        if (key.kind !== "identifier") {
            throw new Error(ERROR_MESSAGES.UNSUPPORTED(`destructured key '${key.value}'`));
        }

        if (stream.matchPunctuation(":")) {
            bindPattern(stream, kind, [...path, key.value], scope);
        } else {
            scope.set(key.value, { kind, path: [...path, key.value] });
        }

        if (!stream.matchPunctuation(",")) {
            stream.expectPunctuation("}");
            return;
        }
    }
}

/** Reads a filter's parameter list — the entity alone, or the `[entity, params]` pair — into a scope. */
const buildScope = (parameterNames: string, hasParams: boolean): { scope: Scope, paramsName: string | null } => {

    const stream = new TokenStream(tokenize(parameterNames));
    const scope: Scope = new Map();

    if (!stream.matchPunctuation("[")) {
        bindPattern(stream, "property", [], scope);
        return { scope, paramsName: null };
    }

    bindPattern(stream, "property", [], scope);

    if (hasParams && stream.matchPunctuation(",") && !stream.isPunctuation("]")) {
        bindPattern(stream, "param", [], scope);
    }

    return { scope, paramsName: wholeParamsName(scope) };
}

/** The name the whole params object was given, when it was not destructured. Error messages only. */
const wholeParamsName = (scope: Scope): string | null => {
    for (const [name, binding] of scope) {
        if (binding.kind === "param" && binding.path.length === 0) {
            return name;
        }
    }

    return null;
}

/**
 * Splits stringified filter source into parameter names and the expression
 * body, unwrapping single-return block bodies.
 */
const resolveFunctionShape = (stringifiedFunction: string, hasParams: boolean): FunctionShape => {

    const source = stringifiedFunction.trim();

    let parameterNames: string;
    let body: string;

    // `function (x) { ... }` / `function name(x) { ... }` — what ES5-targeting
    // transpilers rewrite every arrow filter into
    const functionHead = /^function\b[^(]*\(/.exec(source);

    if (functionHead != null) {
        const parametersEnd = source.indexOf(")", functionHead[0].length);

        if (parametersEnd === -1) {
            throw new Error("Invalid Function");
        }

        parameterNames = source.slice(functionHead[0].length, parametersEnd).trim();
        body = source.slice(parametersEnd + 1).trim();
    } else {
        const arrowIndex = source.indexOf("=>");

        if (arrowIndex === -1) {
            throw new Error("Invalid Function");
        }

        parameterNames = source.substring(0, arrowIndex).trim();
        body = source.substring(arrowIndex + 2).trim();

        // Strip wrapping parens: (entity) or ([x, p])
        if (parameterNames.startsWith("(") && parameterNames.endsWith(")")) {
            parameterNames = parameterNames.slice(1, -1).trim();
        }
    }

    if (parameterNames.length === 0) {
        throw new Error("Invalid Function");
    }

    const { scope, paramsName } = buildScope(parameterNames, hasParams);

    return { scope, paramsName, body };
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
    // hit in practice — it only guards against unbounded dynamic generation.
    // Stryker disable next-line all: the cap is a pure resource bound — every mutation of
    // it (never clear, always clear, off-by-one) parses identically and differs only in
    // memory growth, which no observable boundary can assert.
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

/**
 * Parses an expression SOURCE FRAGMENT against one schema and one root name.
 *
 * `toExpression` starts from a function and works out its own roots. This starts from text, which
 * is what a caller has when it has split a larger predicate apart — `p.rank > 10` lifted out of
 * `([p, m]) => p.rank > 10 && m.won === true`.
 *
 * **A fragment naming anything other than `rootName` returns `NOT_PARSABLE`, and that is the
 * point.** It is how a caller discovers which side of a join a conjunct belongs to: parse it
 * against each side in turn, and exactly one succeeds for a single-side condition. A condition
 * spanning both fails against both, which is the correct answer — it cannot be pushed to either.
 *
 * No params: a fragment carrying a params reference has no bag to resolve it against here, so it
 * fails rather than binding to nothing.
 *
 * Deliberately NOT cached. The cache is keyed by function source, and a fragment is not a function
 * — two different lambdas can contain the same fragment text against different schemas.
 */
export const parseFragment = (schema: CompiledSchema<any>, body: string, rootName: string): Expression => {
    try {
        const stream = new TokenStream(tokenize(body));
        const scope: Scope = new Map([[rootName, { kind: "property", path: [] }]]);
        const parser = new ExpressionParser(schema, stream, scope, null, undefined);

        return parser.parse();
    } catch {
        // The failure is expected and informative — see above — so it is not logged. A caller that
        // parses one conjunct against two schemas would otherwise warn on every successful split.
        return Expression.NOT_PARSABLE;
    }
};

export const toExpression = <T extends any, P extends any>(schema: CompiledSchema<any>, fn: Filter<T> | ParamsFilter<T, P>, params?: P) => {
    const stringifiedFunction = fn.toString();

    const warn = (error: unknown) => logger.warn("Error parsing expression", {
        error,
        collectionName: schema.collectionName,
        params,
        selector: stringifiedFunction
    });

    const cached = getCachedTemplate(schema, stringifiedFunction);

    if (cached != null) {
        // A cached failure — the warning was already logged when it was discovered
        if (Expression.isNotParsable(cached.template)) {
            return Expression.NOT_PARSABLE;
        }

        try {
            return bindExpression(cached.template, cached.paramsName, params);
        } catch (error) {
            // Binding failures are param-dependent by nature — never cached
            warn(error);
            return Expression.NOT_PARSABLE;
        }
    }

    let paramsName: string | null = null;
    let template: Expression;
    let structurallyDependsOnParams: boolean;

    try {
        const shape = resolveFunctionShape(stringifiedFunction, params != null);
        const stream = new TokenStream(tokenize(shape.body));
        const parser = new ExpressionParser(schema, stream, shape.scope, shape.paramsName, params);
        paramsName = shape.paramsName;
        template = parser.parseBody();
        structurallyDependsOnParams = parser.structurallyDependsOnParams;
    } catch (error) {
        // Cache the failure so a hot query on an unsupported filter doesn't
        // re-parse and re-warn on every execution.  Param-dependent failures are
        // exempt: the same source can succeed with different params.
        if (!(error instanceof ParamDependentParseError)) {
            setCachedTemplate(schema, stringifiedFunction, { template: Expression.NOT_PARSABLE, paramsName: null });
        }

        warn(error);
        return Expression.NOT_PARSABLE;
    }

    // Templates whose structure was resolved from param values are only
    // valid for this exact params object — parse those fresh every time
    if (!structurallyDependsOnParams) {
        setCachedTemplate(schema, stringifiedFunction, { template, paramsName });
    }

    try {
        return bindExpression(template, paramsName, params);
    } catch (error) {
        warn(error);
        return Expression.NOT_PARSABLE;
    }
}
