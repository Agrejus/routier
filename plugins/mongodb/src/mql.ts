/**
 * MongoDB query language (MQL) generation from expression trees.
 *
 * Uses a **Visitor** over the expression AST, mirroring `toSql` in
 * `@routier/sql-plugin-core`. The output is a filter document to hand to `find`,
 * not a string, so there is no dialect Strategy and no parameter list: MQL carries
 * its values inline and a document is not vulnerable to injection the way a
 * concatenated string is.
 *
 * Three differences from the SQL translator drive most of the code below.
 *
 * 1. **A field must be a key.** SQL can emit `? < col`; MQL cannot. When the property
 *    is the right-hand operand the comparator has to be MIRRORED (`5 < entity.price`
 *    becomes `{ price: { $gt: 5 } }`), because the alternative — treating the operand
 *    order as irrelevant — silently returns the complement of the intended rows.
 * 2. **Nested properties are first-class.** SQL plugins store a nested object as a JSON
 *    column and cannot filter into it; Mongo addresses `payload.operand.value` with dot
 *    notation, so the property path is used whole.
 * 3. **A property-side transformer needs `$expr`.** `LOWER(col) = ?` has no equivalent
 *    in a plain filter document. Those comparisons switch to the aggregation-expression
 *    form, which is a different shape rather than a different operator.
 */
import type {
    Call,
    ComparatorExpression,
    Expression,
    PropertyExpression,
} from "@routier/core/expressions";
import {
    isCallExpression,
    peelCalls,
    isComparatorExpression,
    isOperatorExpression,
    isPropertyExpression,
    isValueExpression,
    SchemaTypes,
} from "@routier/core";

/** A MongoDB filter document, as accepted by `collection.find`. */
export type MqlFilter = Record<string, unknown>;

/**
 * Comparators that map to a single MQL operator, in both the plain and negated case.
 *
 * The negated form is stated rather than wrapped in `$not` because `$not` on a field
 * predicate also matches documents where the field is MISSING, so `$not: { $gt: 5 }`
 * and `$lte: 5` are not the same query. Naming the inverse operator keeps a negated
 * comparison over present values, which is what `!(x > 5)` means to the caller.
 */
const RANGE_OPERATORS: Record<string, { plain: string; negated: string }> = {
    "equals": { plain: "$eq", negated: "$ne" },
    "greater-than": { plain: "$gt", negated: "$lte" },
    "greater-than-equals": { plain: "$gte", negated: "$lt" },
    "less-than": { plain: "$lt", negated: "$gte" },
    "less-than-equals": { plain: "$lte", negated: "$gt" },
};

/**
 * The same comparison read from the other side.
 *
 * Applied when the property is the RIGHT operand. `equals` is its own mirror; the
 * four range comparators swap. Omitting this is the MQL form of the operand-order
 * defect recorded against the SQL equals path — the query stays valid and returns
 * the wrong rows.
 */
const MIRRORED: Record<string, string> = {
    "equals": "equals",
    "greater-than": "less-than",
    "greater-than-equals": "less-than-equals",
    "less-than": "greater-than",
    "less-than-equals": "greater-than-equals",
};

/** Aggregation-expression counterparts, for the `$expr` path. */
const EXPR_OPERATORS: Record<string, { plain: string; negated: string }> = {
    "equals": { plain: "$eq", negated: "$ne" },
    "greater-than": { plain: "$gt", negated: "$lte" },
    "greater-than-equals": { plain: "$gte", negated: "$lt" },
    "less-than": { plain: "$lt", negated: "$gte" },
    "less-than-equals": { plain: "$lte", negated: "$gt" },
};

const STRING_PATTERN_COMPARATORS = ["starts-with", "ends-with", "includes"];

/** Every character with meaning in a regular expression, so a literal stays literal. */
function escapeRegexLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(escapedValue: string, comparator: string): string {
    if (comparator === "starts-with") {
        return `^${escapedValue}`;
    }

    if (comparator === "ends-with") {
        return `${escapedValue}$`;
    }

    return escapedValue;
}

/**
 * Applies a call to a literal before it is embedded — the database never sees a call on a value,
 * only its result.
 */
function applyCallsToValue(value: unknown, calls: Call[]): unknown {
    return calls.reduce<unknown>((current, call) => {
        if (call === "to-lower-case" && typeof current === "string") {
            return current.toLowerCase();
        }

        if (call === "to-upper-case" && typeof current === "string") {
            return current.toUpperCase();
        }

        if (call === "length" && (typeof current === "string" || Array.isArray(current))) {
            return current.length;
        }

        throw new Error(
            `'${call}' cannot be applied to the value '${String(current)}' before embedding it. ` +
            `Embedding the value unchanged would match against the wrong thing.`
        );
    }, value);
}

/**
 * Storage-side dotted path for a property.
 *
 * Each segment resolves through `from`, so a renamed nested property addresses the name
 * that is actually stored rather than the name the schema exposes. Mongo reads
 * `a.b.c` natively, which is why nested filtering works here and not in the SQL plugins.
 */
export function toFieldPath(prop: PropertyExpression): string {
    const parents = prop.property.getParentPathArray({ useFromPropertyName: true });

    return [...parents, prop.property.getResolvedName()].join(".");
}

/**
 * Result of splitting a comparator into its property and value sides.
 *
 * The absent-side sentinel is `undefined`, never `null`, for the same reason the SQL
 * translator says so: `null` is a legitimate operand (`entity.deletedAt == null`), so
 * using it to mean "not a value expression" makes a real null indistinguishable from a
 * property side.
 */
interface PropertyValueSides {
    propLeft: PropertyExpression | null;
    propRight: PropertyExpression | null;
    callsLeft: Call[];
    callsRight: Call[];
    valLeft: unknown;
    valRight: unknown;
}

function getPropertyValueSides(cmp: ComparatorExpression): PropertyValueSides {
    const left = peelCalls(cmp.left);
    const right = peelCalls(cmp.right);

    return {
        propLeft: left != null && isPropertyExpression(left.operand) ? left.operand : null,
        propRight: right != null && isPropertyExpression(right.operand) ? right.operand : null,
        callsLeft: left?.calls ?? [],
        callsRight: right?.calls ?? [],
        valLeft: left != null && isValueExpression(left.operand) ? applyCallsToValue(left.operand.value, left.calls) : undefined,
        valRight: right != null && isValueExpression(right.operand) ? applyCallsToValue(right.operand.value, right.calls) : undefined,
    };
}

/**
 * The one property side and the one value side of a comparison, with the comparator
 * already mirrored when the property was on the right.
 *
 * Returns null when the comparison is not property-to-value — two properties, or two
 * literals — which the caller handles separately because those cannot be a field key.
 */
interface OrientedComparison {
    prop: PropertyExpression;
    calls: Call[];
    value: unknown;
    comparator: string;
}

function orient(cmp: ComparatorExpression): OrientedComparison | null {
    const { propLeft, propRight, callsLeft, callsRight, valLeft, valRight } = getPropertyValueSides(cmp);

    if (propLeft != null && valRight !== undefined) {
        return { prop: propLeft, calls: callsLeft, value: valRight, comparator: cmp.comparator };
    }

    if (propRight != null && valLeft !== undefined) {
        return { prop: propRight, calls: callsRight, value: valLeft, comparator: MIRRORED[cmp.comparator] ?? cmp.comparator };
    }

    return null;
}

/**
 * Aggregation expression for a property reference, wrapping it in the operator its
 * transformer calls for. Ignoring the transformer would silently return wrong rows.
 */
function renderExprOperand(prop: PropertyExpression, calls: Call[]): unknown {
    return calls.reduce<unknown>((rendered, call) => {
        if (call === "to-lower-case") {
            return { $toLower: rendered };
        }

        if (call === "to-upper-case") {
            return { $toUpper: rendered };
        }

        if (call === "length") {
            return prop.property.type === SchemaTypes.Array
                ? { $size: rendered }
                : { $strLenCP: rendered };
        }

        throw new Error(
            `'${call}' has no MQL form. Rendering the field without it would match against the ` +
            `stored value instead of the called one.`
        );
    }, `$${toFieldPath(prop)}`);
}

/**
 * The `$expr` form, used whenever a property side carries a transformer or when both
 * sides are properties.
 *
 * `$expr` is a strictly larger hammer — it cannot use an index the way a field predicate
 * can — so it is reached for only in the cases a plain predicate cannot express, not as
 * a uniform strategy.
 */
function renderExprComparison(cmp: ComparatorExpression): MqlFilter {
    if (STRING_PATTERN_COMPARATORS.includes(cmp.comparator)) {
        return renderExprStringPattern(cmp);
    }

    const operators = EXPR_OPERATORS[cmp.comparator];

    if (operators == null) {
        throw new Error(`Unsupported comparator: ${cmp.comparator}`);
    }

    const left = renderExprSide(cmp.left);
    const right = renderExprSide(cmp.right);
    const operator = cmp.negated ? operators.negated : operators.plain;

    return { $expr: { [operator]: [left, right] } };
}

function renderExprSide(expression: Expression | undefined): unknown {
    if (expression == null) {
        throw new Error("Comparison is missing an operand");
    }

    if (isPropertyExpression(expression)) {
        return renderExprOperand(expression, []);
    }

    if (isValueExpression(expression)) {
        return { $literal: expression.value };
    }

    if (isCallExpression(expression)) {
        const peeled = peelCalls(expression);

        if (peeled != null && isPropertyExpression(peeled.operand)) {
            return renderExprOperand(peeled.operand, peeled.calls);
        }

        if (peeled != null && isValueExpression(peeled.operand)) {
            return { $literal: applyCallsToValue(peeled.operand.value, peeled.calls) };
        }
    }

    throw new Error(`Unsupported operand in comparison: ${expression.type}`);
}

/**
 * A string pattern against a transformed property, as `$regexMatch`.
 *
 * Kept separate from {@link renderExprComparison} because a pattern is not a binary
 * comparison: the value side becomes a regex rather than an operand.
 */
function renderExprStringPattern(cmp: ComparatorExpression): MqlFilter {
    const oriented = orient(cmp);

    if (oriented == null || oriented.value == null) {
        throw new Error(`Complex expressions not supported for ${cmp.comparator} operations`);
    }

    const pattern = buildPattern(escapeRegexLiteral(String(oriented.value)), oriented.comparator);
    const match = { $regexMatch: { input: renderExprOperand(oriented.prop, oriented.calls), regex: pattern } };

    return { $expr: cmp.negated ? { $not: match } : match };
}

/**
 * `includes` against an array property, or against an array literal.
 *
 * Two different questions share the comparator. `tags.includes('x')` asks whether the
 * stored array contains a value, and Mongo answers that with a plain equality against
 * the field. `['a','b'].includes(entity.status)` asks the reverse — whether the stored
 * scalar is one of a set — which is `$in`.
 */
function renderIncludes(cmp: ComparatorExpression, oriented: OrientedComparison): MqlFilter {
    const field = toFieldPath(oriented.prop);

    if (Array.isArray(oriented.value)) {
        return { [field]: { [cmp.negated ? "$nin" : "$in"]: oriented.value } };
    }

    if (oriented.value == null) {
        // `LIKE '%null%'` is never what the caller meant, and neither is a regex over
        // the literal "null". Rejected rather than guessed at.
        throw new Error("Complex expressions not supported for includes operations");
    }

    if (oriented.prop.property.type === SchemaTypes.Array) {
        // Equality against an array field is membership in Mongo, so this needs no
        // operator — and unlike `$regex` it can use a multikey index.
        return { [field]: cmp.negated ? { $ne: oriented.value } : oriented.value };
    }

    return renderRegexPredicate(field, String(oriented.value), "includes", cmp.negated);
}

function renderRegexPredicate(
    field: string,
    value: string,
    comparator: string,
    negated: boolean
): MqlFilter {
    const pattern = buildPattern(escapeRegexLiteral(value), comparator);

    return { [field]: negated ? { $not: new RegExp(pattern) } : { $regex: pattern } };
}

/**
 * A comparison that reaches a field predicate — the common case, and the only one that
 * can use an index.
 */
function renderFieldComparison(cmp: ComparatorExpression, oriented: OrientedComparison): MqlFilter {
    const field = toFieldPath(oriented.prop);

    if (oriented.comparator === "includes") {
        return renderIncludes(cmp, oriented);
    }

    if (oriented.comparator === "starts-with" || oriented.comparator === "ends-with") {
        if (oriented.value == null) {
            throw new Error(`Complex expressions not supported for ${oriented.comparator} operations`);
        }

        return renderRegexPredicate(field, String(oriented.value), oriented.comparator, cmp.negated);
    }

    const operators = RANGE_OPERATORS[oriented.comparator];

    if (operators == null) {
        throw new Error(`Unsupported comparator: ${oriented.comparator}`);
    }

    return { [field]: { [cmp.negated ? operators.negated : operators.plain]: oriented.value } };
}

/**
 * Converts an Expression to a MongoDB filter document.
 *
 * A note on null, because Mongo draws a distinction the SQL engines do not. `{ f: null }`
 * matches documents where `f` is null AND documents where `f` is absent, whereas
 * `col IS NULL` has no absent case — a column always exists. The two agree for documents
 * Routier wrote, since a schema serialises a nullable property as an explicit null rather
 * than omitting it. They diverge over documents written by something else, and this
 * translator deliberately takes the Mongo-native reading rather than adding a `$type`
 * check that would make Routier's own rows behave differently from every other backend.
 */
export function toMql(expr: Expression): MqlFilter {
    function walk(e: Expression): MqlFilter {
        if (isOperatorExpression(e)) {
            const operator = e.operator === "&&" ? "$and" : "$or";
            const operands: MqlFilter[] = [];

            if (e.left) {
                operands.push(walk(e.left));
            }

            if (e.right) {
                operands.push(walk(e.right));
            }

            // A one-sided operator is the operand itself. `$and: [x]` is valid but
            // needlessly nested, and the flatter document is easier to read in a log.
            return operands.length === 1 ? operands[0] : { [operator]: operands };
        }

        if (isComparatorExpression(e)) {
            const oriented = orient(e);

            // Not property-to-value (two properties, or two literals), or a property side
            // that has to be transformed first. Neither can be a field key.
            if (oriented == null || oriented.calls.length > 0) {
                return renderExprComparison(e);
            }

            return renderFieldComparison(e, oriented);
        }

        throw new Error(`Unknown expression type: ${(e as Expression).type}`);
    }

    // A tautology (`x => true`) — no documents are excluded. The MQL counterpart of
    // the SQL translator's `1 = 1`.
    if (expr.type === "empty") {
        return {};
    }

    /**
     * Core could not parse the filter into an expression — a call it has no rule for, or a
     * closure over something outside the entity. It is a node the parser produces routinely,
     * not a corrupt tree, so it gets a message that names the situation. The caller's job is
     * to evaluate the filter in memory instead; falling back silently here would turn a
     * bounded query into a full collection scan without saying so.
     */
    if (expr.type === "not-parsable") {
        throw new Error(
            "Filter could not be parsed into an expression and has no MQL form. Evaluate it in " +
            "memory instead — route the query option to the memory execution target rather " +
            "than pushing it down."
        );
    }

    return walk(expr);
}
