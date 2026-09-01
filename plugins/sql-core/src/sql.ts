/**
 * Dialect-aware SQL WHERE generation from expression trees.
 *
 * Uses a **Strategy** for SQL dialects (quoting, placeholders, LIKE vs GLOB).
 * Uses a **Visitor** over the expression AST. Equals comparison uses a Strategy
 * per (column-side, null vs value) case.
 */
import type { Call, CallExpression, ComparatorExpression, Expression, PropertyExpression } from "@routier/core/expressions";
import {
    foldedOperandValue,
    forEach,
    isCallExpression,
    peelCalls,
    isComparatorExpression,
    isOperatorExpression,
    isPropertyExpression,
    isValueExpression,
    SchemaTypes,
} from "@routier/core";

/** Supported SQL dialect names. */
export type SqlDialectName = "sqlite" | "postgresql" | "mysql" | "mssql";

/**
 * Dialect interface for generating portable SQL WHERE fragments.
 */
export interface SqlDialect {
    /** Which engine this is. A claim can depend on the engine, not only on the call. */
    name: SqlDialectName;
    /**
     * `a IS DISTINCT FROM b` — inequality that a NULL satisfies, which is what JavaScript means.
     * Thunked because a dialect that names an operand twice has to bind it twice.
     */
    isDistinctFrom(left: () => string, right: () => string): string;
    quoteIdentifier(name: string): string;
    getPlaceholder(paramIndex: number): string;
    stringMatchKind: "LIKE" | "GLOB";
    likeEscapeClause(): string;
    /**
     * Column type for a nested object or array held in a single column.
     *
     * Nested structures have no native column type in any SQL engine, so each one gets
     * stored as JSON in whatever form that engine offers. Core never sees this — it hands
     * plugins a partial entity and the plugin decides how a nested value becomes a column.
     */
    jsonColumnType: string;
    /**
     * Encodes a nested object or array for a `jsonColumnType` parameter.
     *
     * Every dialect stringifies today. It is a dialect method anyway because it is exactly
     * the kind of thing that diverges — `pg` can bind a JS object straight to `jsonb`, and
     * a driver that prefers that should be able to say so here rather than somewhere a
     * caller has to remember.
     */
    encodeJson(value: unknown): unknown;
    /**
     * Bindable form of a value for a `s.date()` property.
     *
     * Most engines accept an ISO-8601 string, which is what a serialized entity carries, so
     * the default is to pass it through. MySQL's DATETIME does not — it rejects both the `T`
     * separator and the `Z` suffix — so that dialect rewrites it.
     */
    encodeDate(value: unknown): unknown;
    /**
     * Bindable form of a value for a `s.boolean()` property.
     *
     * Most engines have a boolean type and take one directly. SQLite does not — it stores them
     * as INTEGER — and `node:sqlite` refuses to bind a JS boolean at all rather than coercing
     * it, so every save of an entity with a boolean failed with "provided value cannot be bound".
     * That is a fact about the engine, so it belongs on the dialect rather than on the caller,
     * who should not have to add a serializer for a type the schema already declares.
     */
    encodeBoolean(value: unknown): unknown;
    /**
     * SQL expression for the length of a column: character count for strings,
     * element count for arrays (which are stored as `jsonColumnType`).
     */
    lengthExpression(column: string, isJsonArray: boolean): string;
    /**
     * Whether this dialect can render a call at all.
     *
     * Declared per dialect rather than centrally because it genuinely differs: `REGEXP` is built into
     * MySQL, absent from SQLite unless the host registers it, and spelled `~` in PostgreSQL.
     */
    renders(call: Call): boolean;
    /**
     * Remainder of two numeric expressions, matching JavaScript's `%`.
     *
     * Takes thunks because a dialect may need an operand more than once, and rendering an operand
     * BINDS it — SQLite has no float remainder, so it computes one from `-`, `*` and a truncating
     * divide, using each side twice. Call each thunk exactly as many times as the expression needs.
     */
    moduloExpression(left: () => string, right: () => string): string;

    /** `CEILING` in MSSQL and MySQL, `CEIL` in SQLite and PostgreSQL — the same function, two spellings. */
    ceilingExpression(operand: string): string;
    /**
     * `^` on most engines; PostgreSQL spells it `#`, because `^` there is exponentiation.
     *
     * Thunks, like `moduloExpression`: SQLite has no xor and builds one from `|` and `&`, naming each
     * operand twice. Rendering an operand binds it, so reusing the text without rebinding would leave
     * placeholders with no parameters behind them.
     */
    bitXorExpression(left: () => string, right: () => string): string;
    /**
     * A numeric operand made safe for a bitwise operator.
     *
     * Numbers are stored as `double precision`, and PostgreSQL has no bitwise operator for that —
     * `operator does not exist: double precision & unknown`. Casting is the whole difference.
     */
    bitwiseOperand(operand: string): string;
    /** `||` in the standard, a function in MySQL, `+` in MSSQL. */
    concatExpression(left: string, right: string): string;
    /** Pattern match. Only declared by a dialect whose `renders` admits `matches`. */
    matchesExpression(subject: string, pattern: string): string;
    /**
     * SQL testing whether a JSON array column holds `value`.
     *
     * `tags.includes("featured")` is membership, not substring matching. Rendering it as
     * `LIKE '%featured%'` is wrong twice over: PostgreSQL and MySQL reject it outright
     * against a JSON column, and SQLite — which stores JSON as text — accepts it and matches
     * the wrong rows, because `"feat"` is a substring of `"featured"` and a value in one
     * element can match against another.
     *
     * Pairs with `encodeArrayContainsValue`, because the dialects disagree about whether the
     * parameter is the raw value or its JSON encoding.
     */
    arrayContainsExpression(column: string, placeholder: string): string;
    /** The parameter `arrayContainsExpression` expects, from the value the caller compared. */
    encodeArrayContainsValue(value: unknown): unknown;
    /**
     * Reads a value out of a JSON column so a nested property can be filtered on.
     *
     * A nested subtree is stored as ONE JSON column named for its root (see
     * `sqlColumnProperties`), so `payload.operand.value` is not a column — it is a path into
     * the `payload` column. Without this the translator rendered the leaf name alone and
     * emitted `"value" = $1`, a column that does not exist.
     *
     * `leafType` is needed because every engine extracts JSON as text by default, and text
     * comparison answers `price > 9` with the wrong rows once a value reaches double digits.
     * Each dialect casts back to the type the schema declared.
     *
     * @param rootColumn Already quoted, as returned by `quoteIdentifier`.
     * @param path Storage-side segment names BELOW the root, leaf last.
     */
    jsonPathExpression(rootColumn: string, path: string[], leafType: SchemaTypes): string;
}

/** A path segment safe to write unquoted in a JSON path literal. */
const SIMPLE_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Escapes a value for use inside a single-quoted SQL string literal. */
const sqlStringLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/**
 * `$.a.b` form, used by SQLite, MySQL and SQL Server.
 *
 * A segment that is not a plain identifier is quoted, because `.from()` accepts any string
 * and an unquoted segment containing a dot would silently address a different level.
 */
const jsonPathLiteral = (path: string[]): string =>
    "$" + path
        .map(segment =>
            SIMPLE_SEGMENT.test(segment)
                ? `.${segment}`
                : `."${segment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        )
        .join("");

/**
 * Engines that accept ISO-8601 directly.
 *
 * A `Date` still has to become one: a driver binds a string, and `s.date()` is stored as ISO, so a
 * filter comparing a Date param has to be bound in the same form the column holds.
 */
const passThroughDate = (value: unknown): unknown =>
    value instanceof Date ? (Number.isNaN(value.getTime()) ? value : value.toISOString()) : value;

/** Engines with a real boolean type take one as it is. */
const passThroughBoolean = (value: unknown): unknown => value;

/** SQLite has no boolean type: 1 and 0, which is what its INTEGER column holds. */
const integerBoolean = (value: unknown): unknown => (value ? 1 : 0);

/** ISO-8601 with a `T` separator, which is what a serialized `s.date()` carries. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * `YYYY-MM-DD HH:MM:SS.mmm` in UTC — the only datetime literal MySQL accepts.
 *
 * MySQL rejects ISO-8601 outright ("Incorrect datetime value") because of the `T` separator
 * and the `Z` suffix, so every `s.date()` write failed against a real server. UTC rather than
 * local time, matching the `timezone: 'Z'` the plugin sets on its pool, so the value read
 * back is the value written.
 *
 * A value that is neither a Date nor an ISO string is left alone: the property may carry its
 * own `.serialize()` producing some other agreed format, and rewriting that would break a
 * schema that was working.
 */
const mysqlDate = (value: unknown): unknown => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? value : value.toISOString().replace('T', ' ').replace('Z', '');
    }

    if (typeof value === 'string' && ISO_DATE_TIME.test(value)) {
        return value.replace('T', ' ').replace(/Z$/, '');
    }

    return value;
};

/**
 * Bitwise is absent on purpose: JavaScript runs ToInt32 on both operands and every engine here is
 * 64-bit, so `2147483648 | 0` is -2147483648 in JavaScript and 2147483648 in SQL.
 */
const UNIVERSAL_CALLS: readonly Call[] = [
    "to-lower-case", "to-upper-case", "length", "trim", "absolute", "round",
    "add", "subtract", "multiply", "divide", "modulo",
    "coalesce", "concat",
];

/**
 * What each engine can express beyond the universal set.
 *
 * Declared per dialect because the differences are real, not stylistic: SQLite has no `POWER` and no
 * `^`, MSSQL has no shift operators, `REGEXP` is built into MySQL and absent from SQLite unless the
 * host registers it, and no engine here has JavaScript's unsigned shift.
 */
/**
 * `conditional` and `matches` are rendered but declared by nobody yet.
 *
 * PostgreSQL rejects a `CASE` whose branches do not unify — `double precision and text cannot be
 * matched` — and the `= true` wrapper a bare boolean call carries returned no rows there. Both run in
 * memory until each engine is checked against a real server, which is correct and merely slower. The
 * renderers stay so the check is a declaration change rather than new code.
 */
const DIALECT_CALLS: Record<SqlDialectName, readonly Call[]> = {
    // `floor` and `ceil` reached SQLite with the math functions in 3.35, which are a compile-time
    // option — so a build without them is a real build, and this dialect serves four drivers
    sqlite: [],
    postgresql: ["power", "floor", "ceiling"],
    mysql: ["power", "floor", "ceiling"],
    mssql: ["power", "floor", "ceiling"],
};

const DIALECTS: Record<SqlDialectName, SqlDialect> = {
    sqlite: {
        name: "sqlite",
        isDistinctFrom(left, right) {
            return `${left()} IS NOT ${right()}`;
        },
        quoteIdentifier(name) {
            return `"${name.replace(/"/g, '""')}"`;
        },
        getPlaceholder(_i) {
            return "?";
        },
        stringMatchKind: "GLOB",
        likeEscapeClause() {
            return "";
        },
        jsonColumnType: "JSON",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: passThroughDate,
        encodeBoolean: integerBoolean,
        /**
         * `%` truncates both operands to integers, so `10.5 % 3` is 1 rather than 1.5. Rebuilt from
         * `a - b * trunc(a / b)`, which agrees with JavaScript on fractions and on negatives.
         */
        bitwiseOperand(operand) {
            return operand;
        },
        bitXorExpression(left, right) {
            // No `^`. Built from the operators SQLite does have: a xor b = (a|b) - (a&b). Each side is
            // named twice, so each thunk is called twice and binds twice.
            return `((${left()} | ${right()}) - (${left()} & ${right()}))`;
        },
        concatExpression(left, right) {
            return `(${left} || ${right})`;
        },
        matchesExpression() {
            throw new Error(
                "SQLite has no built-in REGEXP. A host that registers the function can render it; " +
                "this dialect does not claim it, so `renders('matches')` is false and the plugin " +
                "reports a missing capability instead."
            );
        },
        renders(call) {
            return UNIVERSAL_CALLS.includes(call) || DIALECT_CALLS.sqlite.includes(call);
        },
        moduloExpression(left, right) {
            return `(${left()} - ${right()} * CAST(${left()} / ${right()} AS INTEGER))`;
        },
        ceilingExpression(operand) {
            return `CEIL(${operand})`;
        },
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `json_array_length(${column})` : `LENGTH(${column})`;
        },
        /** `json_each` expands the array into rows; its `value` column is already typed. */
        arrayContainsExpression(column, placeholder) {
            return `EXISTS (SELECT 1 FROM json_each(${column}) WHERE json_each.value = ${placeholder})`;
        },
        encodeArrayContainsValue(value) {
            return typeof value === "boolean" ? integerBoolean(value) : value;
        },
        /**
         * `json_extract` is the one extractor that already returns a typed value — INTEGER,
         * REAL or TEXT as the document holds it — so SQLite needs no cast. JSON1 has been
         * built in since 3.38, and 3.45 added the JSONB storage format on top of the same
         * function names.
         */
        jsonPathExpression(rootColumn, path) {
            return `json_extract(${rootColumn}, ${sqlStringLiteral(jsonPathLiteral(path))})`;
        },
    },
    postgresql: {
        name: "postgresql",
        isDistinctFrom(left, right) {
            return `${left()} IS DISTINCT FROM ${right()}`;
        },
        quoteIdentifier(name) {
            return `"${name.replace(/"/g, '""')}"`;
        },
        getPlaceholder(i) {
            return `$${i + 1}`;
        },
        stringMatchKind: "LIKE",
        likeEscapeClause() {
            return " ESCAPE E'\\\\'";
        },
        jsonColumnType: "JSONB",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: passThroughDate,
        encodeBoolean: passThroughBoolean,
        /** No `%` for `double precision`, and a bound parameter arrives untyped. */
        /** No bitwise operator for `double precision`. `::bigint` alone ROUNDS; JavaScript truncates. */
        bitwiseOperand(operand) {
            // `::numeric` first: a bound parameter arrives untyped and `trunc(unknown)` is ambiguous.
            return `(trunc((${operand})::numeric))::bigint`;
        },
        bitXorExpression(left, right) {
            // `^` is exponentiation in PostgreSQL; `#` is the bitwise xor
            return `(${left()} # ${right()})`;
        },
        concatExpression(left, right) {
            return `(${left} || ${right})`;
        },
        matchesExpression(subject, pattern) {
            return `(${subject} ~ ${pattern})`;
        },
        renders(call) {
            return UNIVERSAL_CALLS.includes(call) || DIALECT_CALLS.postgresql.includes(call);
        },
        moduloExpression(left, right) {
            return `MOD((${left()})::numeric, (${right()})::numeric)`;
        },
        ceilingExpression(operand) {
            return `CEIL(${operand})`;
        },
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `jsonb_array_length(${column})` : `LENGTH(${column})`;
        },
        /**
         * `@>` is containment, and a scalar on the right asks whether the array holds it:
         * `'["a","b"]'::jsonb @> '"a"'::jsonb` is true. It uses a GIN index where one exists.
         */
        arrayContainsExpression(column, placeholder) {
            return `${column} @> ${placeholder}::jsonb`;
        },
        encodeArrayContainsValue(value) {
            return JSON.stringify(value);
        },
        /**
         * `->` to navigate and `->>` for the final hop, which yields text. The cast back to
         * the declared type is what makes `count > 9` order numerically instead of
         * lexicographically — as text, `'10' < '9'`.
         */
        jsonPathExpression(rootColumn, path, leafType) {
            const segments = path.map(sqlStringLiteral);
            const leaf = segments[segments.length - 1];
            const parents = segments.slice(0, -1);
            const navigated = parents.length > 0 ? `${rootColumn}->${parents.join("->")}` : rootColumn;
            const text = `${navigated}->>${leaf}`;

            if (leafType === SchemaTypes.Number) {
                return `(${text})::numeric`;
            }

            if (leafType === SchemaTypes.Boolean) {
                return `(${text})::boolean`;
            }

            return text;
        },
    },
    mysql: {
        name: "mysql",
        isDistinctFrom(left, right) {
            return `NOT (${left()} <=> ${right()})`;
        },
        quoteIdentifier(name) {
            return "`" + name.replace(/`/g, "``") + "`";
        },
        getPlaceholder(_i) {
            return "?";
        },
        stringMatchKind: "LIKE",
        likeEscapeClause() {
            return " ESCAPE '\\\\'";
        },
        jsonColumnType: "JSON",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: mysqlDate,
        encodeBoolean: passThroughBoolean,
        bitwiseOperand(operand) {
            return operand;
        },
        bitXorExpression(left, right) {
            return `(${left()} ^ ${right()})`;
        },
        concatExpression(left, right) {
            return `CONCAT(${left}, ${right})`;
        },
        matchesExpression(subject, pattern) {
            return `(${subject} REGEXP ${pattern})`;
        },
        renders(call) {
            return UNIVERSAL_CALLS.includes(call) || DIALECT_CALLS.mysql.includes(call);
        },
        moduloExpression(left, right) {
            return `(${left()} % ${right()})`;
        },
        ceilingExpression(operand) {
            return `CEILING(${operand})`;
        },
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `JSON_LENGTH(${column})` : `CHAR_LENGTH(${column})`;
        },
        /** `JSON_CONTAINS(target, candidate)` wants the candidate as JSON text. */
        arrayContainsExpression(column, placeholder) {
            return `JSON_CONTAINS(${column}, ${placeholder})`;
        },
        encodeArrayContainsValue(value) {
            return JSON.stringify(value);
        },
        /**
         * `JSON_EXTRACT` alone returns a JSON scalar, so a string comes back still wearing
         * its quotes and `= 'deep'` never matches. `JSON_UNQUOTE` strips them.
         *
         * Booleans then arrive as the text `'true'`/`'false'` while the driver binds a JS
         * boolean as 1/0, so the comparison is rewritten to produce 1/0 rather than cast.
         */
        jsonPathExpression(rootColumn, path, leafType) {
            const extracted = `JSON_UNQUOTE(JSON_EXTRACT(${rootColumn}, ${sqlStringLiteral(jsonPathLiteral(path))}))`;

            if (leafType === SchemaTypes.Number) {
                return `CAST(${extracted} AS DECIMAL(65,30))`;
            }

            if (leafType === SchemaTypes.Boolean) {
                return `(${extracted} = 'true')`;
            }

            return extracted;
        },
    },
    mssql: {
        name: "mssql",
        isDistinctFrom(left, right) {
            // No IS DISTINCT FROM before 2022, and each operand is named once here.
            return `CASE WHEN EXISTS (SELECT ${left()} INTERSECT SELECT ${right()}) THEN 0 ELSE 1 END = 1`;
        },
        quoteIdentifier(name) {
            return "[" + name.replace(/]/g, "]]") + "]";
        },
        getPlaceholder(i) {
            return `@p${i + 1}`;
        },
        stringMatchKind: "LIKE",
        likeEscapeClause() {
            return " ESCAPE '\\\\'";
        },
        jsonColumnType: "NVARCHAR(MAX)",
        encodeJson(value) {
            return JSON.stringify(value);
        },
        encodeDate: passThroughDate,
        encodeBoolean: passThroughBoolean,
        /** `%` rejects `float`, so both sides are cast. */
        bitwiseOperand(operand) {
            return `CAST(${operand} AS bigint)`;
        },
        bitXorExpression(left, right) {
            return `(${left()} ^ ${right()})`;
        },
        concatExpression(left, right) {
            return `(${left} + ${right})`;
        },
        matchesExpression() {
            throw new Error(
                "MSSQL has no regular-expression operator, so this dialect does not claim `matches`."
            );
        },
        renders(call) {
            return UNIVERSAL_CALLS.includes(call) || DIALECT_CALLS.mssql.includes(call);
        },
        moduloExpression(left, right) {
            return `((${left()}) % CAST(${right()} AS decimal(38, 10)))`;
        },
        ceilingExpression(operand) {
            return `CEILING(${operand})`;
        },
        lengthExpression(column, isJsonArray) {
            return isJsonArray ? `(SELECT COUNT(*) FROM OPENJSON(${column}))` : `LEN(${column})`;
        },
        /** `OPENJSON` over an array yields one row per element, with the element in `value`. */
        arrayContainsExpression(column, placeholder) {
            return `EXISTS (SELECT 1 FROM OPENJSON(${column}) WHERE value = ${placeholder})`;
        },
        encodeArrayContainsValue(value) {
            return value;
        },
        /** `JSON_VALUE` returns nvarchar, so numbers and booleans both need rewriting. */
        jsonPathExpression(rootColumn, path, leafType) {
            const extracted = `JSON_VALUE(${rootColumn}, ${sqlStringLiteral(jsonPathLiteral(path))})`;

            if (leafType === SchemaTypes.Number) {
                return `CAST(${extracted} AS FLOAT)`;
            }

            if (leafType === SchemaTypes.Boolean) {
                return `CASE WHEN ${extracted} = 'true' THEN 1 ELSE 0 END`;
            }

            return extracted;
        },
    },
};

export function getDialect(name: SqlDialectName): SqlDialect {
    const d = DIALECTS[name];
    if (!d) throw new Error(`Unknown SQL dialect: ${name}`);
    return d;
}

function escapeLikeLiteral(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function escapeGlobLiteral(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/\?/g, "\\?");
}

function escapeForPattern(value: string, kind: "LIKE" | "GLOB"): string {
    return kind === "LIKE" ? escapeLikeLiteral(value) : escapeGlobLiteral(value);
}

function buildPattern(
    escapedValue: string,
    match: "contains" | "starts-with" | "ends-with",
    kind: "LIKE" | "GLOB"
): string {
    if (kind === "LIKE") {
        switch (match) {
            case "contains":
                return `%${escapedValue}%`;
            case "starts-with":
                return `${escapedValue}%`;
            case "ends-with":
                return `%${escapedValue}`;
        }
    }
    switch (match) {
        case "contains":
            return `*${escapedValue}*`;
        case "starts-with":
            return `${escapedValue}*`;
        case "ends-with":
            return `*${escapedValue}`;
    }
}

const SQL_ARITHMETIC: Partial<Record<Call, string>> = {
    "add": "+",
    "subtract": "-",
    "multiply": "*",
    "divide": "/",
    "modulo": "%",
    "bit-and": "&",
    "bit-or": "|",
    "shift-left": "<<",
    "shift-right": ">>",
};


/**
 * Renders a property reference as a column, wrapping it in the SQL function the
 * parsed transformer calls for (LOWER/UPPER/length). Ignoring the transformer
 * here would silently return wrong rows.
 */
/**
 * The column, or the JSON path into it when the property is nested.
 *
 * `getResolvedName()` returns the LEAF name, which is a real column only for a root
 * property. For `payload.operand.value` the storage is a `payload` JSON column and the rest
 * of the chain is a path inside it.
 */
/**
 * Qualifies a column identifier with a table alias, when there is one.
 *
 * Applied to the ROOT identifier only. A nested property is read out of a JSON column, so the
 * alias belongs on the column the JSON lives in — `"o"."nested" -> '$.inner'` — not on the path
 * inside it.
 */
const qualify = (identifier: string, alias: string | undefined, d: SqlDialect): string =>
    alias == null ? identifier : `${d.quoteIdentifier(alias)}.${identifier}`;

function renderColumnBase(prop: PropertyExpression, d: SqlDialect, alias?: string): string {
    const parents = prop.property.getParentPathArray({ useFromPropertyName: true });

    if (parents.length === 0) {
        return qualify(d.quoteIdentifier(prop.property.getResolvedName()), alias, d);
    }

    const [root, ...rest] = parents;

    return d.jsonPathExpression(
        qualify(d.quoteIdentifier(root), alias, d),
        [...rest, prop.property.getResolvedName()],
        prop.property.type
    );
}

/**
 * Renders a binary call's operand: a literal binds a parameter, a property becomes another column.
 *
 * Recursive, so `x.age * 2 + 1` renders both levels, and it takes the parameter list because that is
 * what binding a literal appends to.
 */
const bindableFor = (d: SqlDialect) => (value: unknown) => {
    if (typeof value === "boolean") {
        return d.encodeBoolean(value);
    }

    // A param carries a real Date; the column holds whatever this engine writes.
    return value instanceof Date ? d.encodeDate(value) : value;
};

/**
 * The placeholder counter, as something a nested render can read and advance.
 *
 * `params.length` is not the same number once an outer statement passed a `paramOffset` — a join
 * does — and a nested render that starts at the wrong index numbers every placeholder after it wrong.
 */
export type PlaceholderCursor = {
    next(): string;
    at(): number;
    skip(count: number): void;
};

const argumentRenderer = (
    d: SqlDialect,
    params: unknown[],
    cursor: PlaceholderCursor,
    alias?: string
): ((expression: Expression) => string) => {
    const placeholder = () => cursor.next();
    const bindable = bindableFor(d);

    const render = (expression: Expression): string => {
        if (isValueExpression(expression)) {
            params.push(bindable(expression.value));

            return placeholder();
        }

        // Bottoms out in a boolean rather than a column, so there is nothing to peel to
        if (isCallExpression(expression) && expression.call === "conditional") {
            return `CASE WHEN ${render(expression.expression)} THEN ${render(expression.arguments[0])} ELSE ${render(expression.arguments[1])} END`;
        }

        // A boolean operand — the condition of a `conditional`. Rendered by the same function that
        // renders a WHERE, offset so its placeholders continue this statement's numbering.
        if (isComparatorExpression(expression) || isOperatorExpression(expression)) {
            const nested = toSql(expression, d, { alias, paramOffset: cursor.at() });

            params.push(...nested.params);
            cursor.skip(nested.params.length);

            return nested.where;
        }

        const peeled = peelCalls(expression);

        if (peeled != null && isPropertyExpression(peeled.operand)) {
            return renderColumn(peeled.operand, d, peeled.calls, render, alias);
        }

        if (peeled != null && isValueExpression(peeled.operand)) {
            params.push(bindable(foldedOperandValue(peeled.operand, peeled.calls)));

            return placeholder();
        }

        throw new Error(`Cannot render '${expression.type}' as a call operand in SQL.`);
    };

    return render;
};

/**
 * The column, wrapped in whatever the calls applied to it render as.
 *
 * `renderArgument` renders a binary call's operand — a value binds a parameter, a property becomes
 * another column — so it belongs to the caller, which is where the parameter list lives.
 */
function renderColumn(
    prop: PropertyExpression,
    d: SqlDialect,
    calls: CallExpression[],
    renderArgument: (expression: Expression) => string,
    alias?: string
): string {
    /**
     * Built from the outside in as thunks rather than folded into a string, so a dialect that needs
     * an operand twice re-renders it — and re-binds whatever parameters are inside it.
     */
    const upTo = (index: number): string => {
        if (index < 0) {
            return renderColumnBase(prop, d, alias);
        }

        const node = calls[index];
        const call = node.call;
        const inner = () => upTo(index - 1);

        if (call === "to-lower-case") {
            return `LOWER(${inner()})`;
        }

        if (call === "to-upper-case") {
            return `UPPER(${inner()})`;
        }

        if (call === "length") {
            return d.lengthExpression(inner(), prop.property.type === SchemaTypes.Array);
        }

        if (call === "trim") {
            return `TRIM(${inner()})`;
        }

        if (call === "absolute") {
            return `ABS(${inner()})`;
        }

        if (call === "floor") {
            return `FLOOR(${inner()})`;
        }

        if (call === "ceiling") {
            return d.ceilingExpression(inner());
        }

        if (call === "round") {
            return `ROUND(${inner()})`;
        }

        if (call === "modulo") {
            return d.moduloExpression(inner, () => renderArgument(node.arguments[0]));
        }

        if (call === "bit-not") {
            return `~${d.bitwiseOperand(inner())}`;
        }

        if (call === "bit-xor") {
            return d.bitXorExpression(
                () => d.bitwiseOperand(inner()),
                () => d.bitwiseOperand(renderArgument(node.arguments[0]))
            );
        }

        if (call === "bit-and" || call === "bit-or") {
            return `(${d.bitwiseOperand(inner())} ${SQL_ARITHMETIC[call]} ${d.bitwiseOperand(renderArgument(node.arguments[0]))})`;
        }

        if (call === "shift-left" || call === "shift-right") {
            // PostgreSQL has `bigint << integer`, not `bigint << bigint`. No dialect claims these.
            return `(${d.bitwiseOperand(inner())} ${SQL_ARITHMETIC[call]} ${renderArgument(node.arguments[0])})`;
        }

        if (call === "power") {
            return `POWER(${inner()}, ${renderArgument(node.arguments[0])})`;
        }

        if (call === "coalesce") {
            return `COALESCE(${inner()}, ${renderArgument(node.arguments[0])})`;
        }

        if (call === "concat") {
            return d.concatExpression(inner(), renderArgument(node.arguments[0]));
        }

        if (call === "matches") {
            return d.matchesExpression(inner(), renderArgument(node.arguments[0]));
        }

        // A CASE, because the condition is a boolean expression rather than a value — it is rendered
        // by the same walk that renders a WHERE, one level down.
        if (call === "conditional") {
            return `CASE WHEN ${renderArgument(node.expression)} THEN ${renderArgument(node.arguments[0])} ELSE ${renderArgument(node.arguments[1])} END`;
        }

        const operator = SQL_ARITHMETIC[call];

        if (operator != null) {
            // Parenthesised, so `(price * ?) > ?` cannot be reassociated by the engine's own
            // precedence into something the caller did not write
            return `(${inner()} ${operator} ${node.arguments.map(renderArgument).join(` ${operator} `)})`;
        }

        throw new Error(
            `'${call}' has no SQL form in this dialect. Rendering the column without it would compare ` +
            `the stored value instead of the called one and return rows that look correct and are not.`
        );
    };

    return upTo(calls.length - 1);
}

/**
 * Result of splitting a comparator into left/right property and value sides.
 *
 * The absent-side sentinel is `undefined`, never `null`: `null` is a legitimate
 * operand (`entity.deletedAt == null`), so using it to mean "this side is not a
 * value expression" makes a real null indistinguishable from a property side.
 * That collision rendered `"x" == entity.prop` as `prop IS NULL`.
 */
interface PropertyValueSides {
    propLeft: PropertyExpression | null;
    propRight: PropertyExpression | null;
    callsLeft: CallExpression[];
    callsRight: CallExpression[];
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
        valLeft: left != null && isValueExpression(left.operand) ? foldedOperandValue(left.operand, left.calls) : undefined,
        valRight: right != null && isValueExpression(right.operand) ? foldedOperandValue(right.operand, right.calls) : undefined,
    };
}

// --- Equals: Strategy per (column-side, null vs value) case ---

type EqualsCase = "null-column-left" | "null-column-right" | "value-column-left" | "value-column-right";

interface EqualsRenderContext {
    /** Thunked: rendering a column binds its call arguments, so it must happen in emission order. */
    col: () => string;
    value: unknown;
    negated: boolean;
    params: unknown[];
    placeholder: () => string;
    dialect: SqlDialect;
}

function getEqualsCase(
    value: unknown,
    columnOnLeft: boolean,
    columnOnRight: boolean
): EqualsCase | null {
    if (value === null && columnOnLeft) return "null-column-left";
    if (value === null && columnOnRight) return "null-column-right";
    if (value !== null && columnOnLeft) return "value-column-left";
    if (value !== null && columnOnRight) return "value-column-right";
    return null;
}

function equalsNullColumnLeft(ctx: EqualsRenderContext): string {
    return ctx.negated ? `${ctx.col()} IS NOT NULL` : `${ctx.col()} IS NULL`;
}

/**
 * `null == entity.prop` — the operand order is reversed but the meaning is not.
 * A null test is not a binary comparison, so unlike the value cases there is no
 * mirrored form to emit: `? IS NULL` with a bound null is the tautology
 * `NULL IS NULL`, true for every row. This renders the column form, identical
 * to {@link equalsNullColumnLeft}, and binds no parameter.
 */
function equalsNullColumnRight(ctx: EqualsRenderContext): string {
    return ctx.negated ? `${ctx.col()} IS NOT NULL` : `${ctx.col()} IS NULL`;
}

function bindValue(ctx: EqualsRenderContext): string {
    ctx.params.push(ctx.value);

    return ctx.placeholder();
}

function equalsValueColumnLeft(ctx: EqualsRenderContext): string {
    // `!=` is UNKNOWN against NULL and SQL drops the row; JavaScript keeps it.
    if (ctx.negated) {
        return ctx.dialect.isDistinctFrom(() => ctx.col(), () => bindValue(ctx));
    }

    return `${ctx.col()} = ${bindValue(ctx)}`;
}

function equalsValueColumnRight(ctx: EqualsRenderContext): string {
    if (ctx.negated) {
        return ctx.dialect.isDistinctFrom(() => bindValue(ctx), () => ctx.col());
    }

    return `${bindValue(ctx)} = ${ctx.col()}`;
}

const EQUALS_STRATEGIES: Record<EqualsCase, (ctx: EqualsRenderContext) => string> = {
    "null-column-left": equalsNullColumnLeft,
    "null-column-right": equalsNullColumnRight,
    "value-column-left": equalsValueColumnLeft,
    "value-column-right": equalsValueColumnRight,
};

// --- String-pattern comparison (includes / starts-with / ends-with) ---

function renderStringPatternComparison(
    cmp: ComparatorExpression,
    d: SqlDialect,
    params: unknown[],
    cursor: PlaceholderCursor,
    alias?: string
): string {
    const placeholder = () => cursor.next();
    const { propLeft, propRight, callsLeft, callsRight, valLeft, valRight } = getPropertyValueSides(cmp);
    const kind = d.stringMatchKind;

    if (cmp.comparator === "includes") {
        const col =
            propLeft && valRight !== undefined
                ? renderColumn(propLeft, d, callsLeft, argumentRenderer(d, params, cursor, alias), alias)
                : propRight && valLeft !== undefined
                  ? renderColumn(propRight, d, callsRight, argumentRenderer(d, params, cursor, alias), alias)
                  : null;
        const value = valRight !== undefined ? valRight : valLeft;

        // A null operand is rejected rather than stringified: `LIKE '%null%'` is
        // never what the caller meant.
        if (col === null || value == null) {
            throw new Error("Complex expressions not supported for includes operations");
        }

        if (Array.isArray(value)) {
            const placeholders = value.map(() => placeholder()).join(", ");
            params.push(...value.map(item => typeof item === "boolean" ? d.encodeBoolean(item) : item));
            return cmp.negated ? `${col} NOT IN (${placeholders})` : `${col} IN (${placeholders})`;
        }

        // `tags.includes(x)` where `tags` is an array property is MEMBERSHIP, not substring
        // matching, and the two disagree: `LIKE '%feat%'` matches a row whose only tag is
        // "featured". PostgreSQL and MySQL reject the comparison outright against a JSON
        // column; SQLite stores JSON as text and answered it wrongly instead.
        const arrayProperty = propLeft?.property.type === SchemaTypes.Array
            ? propLeft
            : propRight?.property.type === SchemaTypes.Array
              ? propRight
              : null;

        if (arrayProperty != null) {
            params.push(d.encodeArrayContainsValue(value));
            const contains = d.arrayContainsExpression(col, placeholder());

            return cmp.negated ? `NOT (${contains})` : contains;
        }

        const escaped = escapeForPattern(String(value), kind);
        const pattern = buildPattern(escaped, "contains", kind);
        params.push(pattern);
        const ph = placeholder();
        const op = kind === "GLOB" ? "GLOB" : "LIKE";
        const escape = kind === "LIKE" ? d.likeEscapeClause() : "";
        if (propLeft && valRight !== undefined) {
            return cmp.negated ? `${col} NOT ${op} ${ph}${escape}` : `${col} ${op} ${ph}${escape}`;
        }
        return cmp.negated ? `${ph} NOT ${op} ${col}${escape}` : `${ph} ${op} ${col}${escape}`;
    }

    const col =
        propLeft && valRight !== undefined
            ? renderColumn(propLeft, d, callsLeft, argumentRenderer(d, params, cursor, alias), alias)
            : propRight && valLeft !== undefined
              ? renderColumn(propRight, d, callsRight, argumentRenderer(d, params, cursor, alias), alias)
              : null;
    const rawValue = valRight !== undefined ? valRight : valLeft;
    const value = rawValue == null ? null : String(rawValue);

    if (col === null || value === null) {
        throw new Error(`Complex expressions not supported for ${cmp.comparator} operations`);
    }

    const escaped = escapeForPattern(value, kind);
    const pattern = buildPattern(
        escaped,
        cmp.comparator === "starts-with" ? "starts-with" : "ends-with",
        kind
    );
    params.push(pattern);
    const ph = placeholder();
    const op = kind === "GLOB" ? "GLOB" : "LIKE";
    const escape = kind === "LIKE" ? d.likeEscapeClause() : "";

    if (propLeft && valRight !== undefined) {
        return cmp.negated ? `${col} NOT ${op} ${ph}${escape}` : `${col} ${op} ${ph}${escape}`;
    }
    return cmp.negated ? `${ph} NOT ${op} ${col}${escape}` : `${ph} ${op} ${col}${escape}`;
}

// --- Generic comparison ---

function renderGenericComparison(
    cmp: ComparatorExpression,
    walk: (e: Expression) => string,
    d: SqlDialect
): string {
    // `walk` binds as it renders, so a side may only be walked as often as the output names it.
    if (cmp.comparator === "equals" && cmp.negated) {
        return d.isDistinctFrom(() => walk(cmp.left!), () => walk(cmp.right!));
    }

    const leftExpr = walk(cmp.left!);
    const rightExpr = walk(cmp.right!);
    switch (cmp.comparator) {
        case "equals":
            return `${leftExpr} = ${rightExpr}`;
        case "greater-than":
            return cmp.negated ? `${leftExpr} <= ${rightExpr}` : `${leftExpr} > ${rightExpr}`;
        case "greater-than-equals":
            return cmp.negated ? `${leftExpr} < ${rightExpr}` : `${leftExpr} >= ${rightExpr}`;
        case "less-than":
            return cmp.negated ? `${leftExpr} >= ${rightExpr}` : `${leftExpr} < ${rightExpr}`;
        case "less-than-equals":
            return cmp.negated ? `${leftExpr} > ${rightExpr}` : `${leftExpr} <= ${rightExpr}`;
        default:
            throw new Error(`Unsupported comparator: ${cmp.comparator}`);
    }
}

export interface ToSqlResult {
    where: string;
    params: unknown[];
}

export type ToSqlOptions = {
    /**
     * Table alias to qualify every column with — `"o"."name"` rather than `"name"`.
     *
     * Needed only when the statement names more than one table, which today means a join. Any
     * column present on BOTH sides is otherwise ambiguous and the engine rejects the whole
     * statement; a discriminator column that every collection carries makes that the normal case
     * rather than an edge one.
     */
    alias?: string;
    /**
     * Where this clause's placeholders start counting.
     *
     * Irrelevant to a dialect with positional `?`, and load-bearing for one with numbered
     * placeholders: two clauses rendered separately and concatenated both start at `$1`, so the
     * second binds the first's values. The caller adding the clauses knows the running total.
     */
    paramOffset?: number;
};

/**
 * Whether every call in a filter has a SQL form in this dialect.
 *
 * A plugin asks before pushing down, and hands the option back when the answer is no — see
 * `QueryOptionsCollection.reportMissingCapability`. Asking beats attempting: the alternative is a statement the
 * engine rejects, which is a failed round trip rather than a slower correct one.
 */
const readsANumber = (expression: Expression | undefined): boolean => {
    if (expression == null) {
        return false;
    }

    let found = false;

    forEach(expression, node => {
        if (isPropertyExpression(node) && node.property.type === SchemaTypes.Number) {
            found = true;

            return false;
        }

        return true;
    });

    return found;
};

/** Calls this engine renders and would answer differently from JavaScript. */
const answersDifferently = (call: CallExpression, d: SqlDialect): boolean => {
    // SQLite renders a REAL 5 as '5.0' where a template literal gives '5'.
    if (d.name === "sqlite" && call.call === "concat") {
        return [call.expression, ...call.arguments].some(readsANumber);
    }

    return false;
};

export function canRenderInSql(expr: Expression, dialect: SqlDialectName | SqlDialect): boolean {
    const d = typeof dialect === "string" ? getDialect(dialect) : dialect;
    let renderable = true;

    forEach(expr, expression => {
        if (isCallExpression(expression) === false) {
            return true;
        }

        // A constant core could not compute. The caller's own predicate answers it in memory.
        const peeled = peelCalls(expression);
        const call = expression as CallExpression;

        if ((peeled != null && isValueExpression(peeled.operand))
            || d.renders(call.call) === false
            || answersDifferently(call, d)) {
            renderable = false;

            return false;
        }

        return true;
    });

    return renderable;
}

/**
 * Converts an Expression to a SQL WHERE clause and bound parameters for the given dialect.
 */
export function toSql(
    expr: Expression,
    dialect: SqlDialectName | SqlDialect,
    options?: ToSqlOptions
): ToSqlResult {
    const d = typeof dialect === "string" ? getDialect(dialect) : dialect;
    const alias = options?.alias;

    /**
     * A value on its way to becoming a bound parameter.
     *
     * Only booleans need touching, and only because an engine may not have the type — SQLite
     * binds 1 and 0, everything else takes a boolean. Applied here rather than at each push
     * site so a filter cannot disagree with what `toColumnAssignments` wrote: comparing
     * `active = true` against a column holding 1 matches nothing, and returns an empty result
     * rather than an error.
     */
    const bindable = bindableFor(d);
    const params: unknown[] = [];
    let paramIndex = options?.paramOffset ?? 0;

    function placeholder(): string {
        const p = d.getPlaceholder(paramIndex);
        paramIndex += 1;
        return p;
    }

    const cursor: PlaceholderCursor = {
        next: placeholder,
        at: () => paramIndex,
        skip: count => { paramIndex += count; }
    };

    /** Visitor: map each expression node type to a SQL fragment. */
    function walk(e: Expression): string {
        if (isOperatorExpression(e)) {
            const left = e.left ? walk(e.left) : "";
            const right = e.right ? walk(e.right) : "";
            const sqlOp = e.operator === "&&" ? "AND" : e.operator === "||" ? "OR" : e.operator;
            return `(${left} ${sqlOp} ${right})`;
        }

        if (isComparatorExpression(e)) {
            const cmp = e;
            const isStringPattern =
                cmp.comparator === "starts-with" ||
                cmp.comparator === "ends-with" ||
                cmp.comparator === "includes";

            if (isStringPattern) {
                /* String pattern: includes / starts-with / ends-with → one renderer. */
                return renderStringPatternComparison(cmp, d, params, cursor, alias);
            }

            if (cmp.comparator === "equals") {
                /* Equals: Strategy per (column-side, null vs value) case. */
                const { propLeft, propRight, callsLeft, callsRight, valLeft, valRight } = getPropertyValueSides(cmp);
                const value = valRight !== undefined ? valRight : valLeft;
                const columnOnLeft = Boolean(propLeft && cmp.right && isValueExpression(cmp.right));
                const columnOnRight = Boolean(propRight && cmp.left && isValueExpression(cmp.left));
                const caseKey = value === undefined ? null : getEqualsCase(value, columnOnLeft, columnOnRight);

                if (caseKey !== null) {
                    // Thunked, not rendered here: `renderColumn` binds, and a strategy that emits the
                    // value first has to bind it first or the parameters swap.
                    const column =
                        propLeft && (valRight !== undefined || propRight)
                            ? { render: () => renderColumn(propLeft, d, callsLeft, argumentRenderer(d, params, cursor, alias), alias) }
                            : propRight && (valLeft !== undefined || propLeft)
                              ? { render: () => renderColumn(propRight, d, callsRight, argumentRenderer(d, params, cursor, alias), alias) }
                              : null;

                    if (column !== null) {
                        const strategy = EQUALS_STRATEGIES[caseKey];
                        return strategy({
                            col: column.render,
                            // Encoded here rather than inside each strategy: they share one
                            // context and only some of them bind the value at all.
                            value: bindable(value),
                            negated: cmp.negated,
                            params,
                            placeholder,
                            dialect: d,
                        });
                    }
                }
            }

            /* Generic: walk both sides and emit comparison operator. */
            return renderGenericComparison(cmp, walk, d);
        }

        if (isPropertyExpression(e)) {
            return renderColumn(e, d, [], argumentRenderer(d, params, cursor, alias), alias);
        }

        if (isValueExpression(e)) {
            params.push(bindable(e.value));
            return placeholder();
        }

        if (isCallExpression(e)) {
            return argumentRenderer(d, params, cursor, alias)(e);
        }

        throw new Error(`Unknown expression type: ${(e as Expression).type}`);
    }

    // A tautology (`x => true`) — no rows are excluded
    if (expr.type === "empty") {
        return { where: "1 = 1", params: [] };
    }

    const where = walk(expr);
    return { where, params };
}
