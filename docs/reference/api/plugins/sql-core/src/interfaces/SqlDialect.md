[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / SqlDialect

# Interface: SqlDialect

Defined in: [plugins/sql-core/src/sql.ts:28](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L28)

Dialect interface for generating portable SQL WHERE fragments.

## Properties

### name

> **name**: [`SqlDialectName`](../type-aliases/SqlDialectName.md)

Defined in: [plugins/sql-core/src/sql.ts:30](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L30)

Which engine this is. A claim can depend on the engine, not only on the call.

***

### stringMatchKind

> **stringMatchKind**: `"LIKE"` \| `"GLOB"`

Defined in: [plugins/sql-core/src/sql.ts:38](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L38)

***

### jsonColumnType

> **jsonColumnType**: `string`

Defined in: [plugins/sql-core/src/sql.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L47)

Column type for a nested object or array held in a single column.

Nested structures have no native column type in any SQL engine, so each one gets
stored as JSON in whatever form that engine offers. Core never sees this — it hands
plugins a partial entity and the plugin decides how a nested value becomes a column.

## Methods

### isDistinctFrom()

> **isDistinctFrom**(`left`, `right`): `string`

Defined in: [plugins/sql-core/src/sql.ts:35](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L35)

`a IS DISTINCT FROM b` — inequality that a NULL satisfies, which is what JavaScript means.
Thunked because a dialect that names an operand twice has to bind it twice.

#### Parameters

##### left

() => `string`

##### right

() => `string`

#### Returns

`string`

***

### quoteIdentifier()

> **quoteIdentifier**(`name`): `string`

Defined in: [plugins/sql-core/src/sql.ts:36](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L36)

#### Parameters

##### name

`string`

#### Returns

`string`

***

### getPlaceholder()

> **getPlaceholder**(`paramIndex`): `string`

Defined in: [plugins/sql-core/src/sql.ts:37](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L37)

#### Parameters

##### paramIndex

`number`

#### Returns

`string`

***

### likeEscapeClause()

> **likeEscapeClause**(): `string`

Defined in: [plugins/sql-core/src/sql.ts:39](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L39)

#### Returns

`string`

***

### encodeJson()

> **encodeJson**(`value`): `unknown`

Defined in: [plugins/sql-core/src/sql.ts:56](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L56)

Encodes a nested object or array for a `jsonColumnType` parameter.

Every dialect stringifies today. It is a dialect method anyway because it is exactly
the kind of thing that diverges — `pg` can bind a JS object straight to `jsonb`, and
a driver that prefers that should be able to say so here rather than somewhere a
caller has to remember.

#### Parameters

##### value

`unknown`

#### Returns

`unknown`

***

### encodeDate()

> **encodeDate**(`value`): `unknown`

Defined in: [plugins/sql-core/src/sql.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L64)

Bindable form of a value for a `s.date()` property.

Most engines accept an ISO-8601 string, which is what a serialized entity carries, so
the default is to pass it through. MySQL's DATETIME does not — it rejects both the `T`
separator and the `Z` suffix — so that dialect rewrites it.

#### Parameters

##### value

`unknown`

#### Returns

`unknown`

***

### encodeBoolean()

> **encodeBoolean**(`value`): `unknown`

Defined in: [plugins/sql-core/src/sql.ts:74](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L74)

Bindable form of a value for a `s.boolean()` property.

Most engines have a boolean type and take one directly. SQLite does not — it stores them
as INTEGER — and `node:sqlite` refuses to bind a JS boolean at all rather than coercing
it, so every save of an entity with a boolean failed with "provided value cannot be bound".
That is a fact about the engine, so it belongs on the dialect rather than on the caller,
who should not have to add a serializer for a type the schema already declares.

#### Parameters

##### value

`unknown`

#### Returns

`unknown`

***

### lengthExpression()

> **lengthExpression**(`column`, `isJsonArray`): `string`

Defined in: [plugins/sql-core/src/sql.ts:79](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L79)

SQL expression for the length of a column: character count for strings,
element count for arrays (which are stored as `jsonColumnType`).

#### Parameters

##### column

`string`

##### isJsonArray

`boolean`

#### Returns

`string`

***

### renders()

> **renders**(`call`): `boolean`

Defined in: [plugins/sql-core/src/sql.ts:86](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L86)

Whether this dialect can render a call at all.

Declared per dialect rather than centrally because it genuinely differs: `REGEXP` is built into
MySQL, absent from SQLite unless the host registers it, and spelled `~` in PostgreSQL.

#### Parameters

##### call

`Call`

#### Returns

`boolean`

***

### moduloExpression()

> **moduloExpression**(`left`, `right`): `string`

Defined in: [plugins/sql-core/src/sql.ts:94](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L94)

Remainder of two numeric expressions, matching JavaScript's `%`.

Takes thunks because a dialect may need an operand more than once, and rendering an operand
BINDS it — SQLite has no float remainder, so it computes one from `-`, `*` and a truncating
divide, using each side twice. Call each thunk exactly as many times as the expression needs.

#### Parameters

##### left

() => `string`

##### right

() => `string`

#### Returns

`string`

***

### ceilingExpression()

> **ceilingExpression**(`operand`): `string`

Defined in: [plugins/sql-core/src/sql.ts:97](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L97)

`CEILING` in MSSQL and MySQL, `CEIL` in SQLite and PostgreSQL — the same function, two spellings.

#### Parameters

##### operand

`string`

#### Returns

`string`

***

### bitXorExpression()

> **bitXorExpression**(`left`, `right`): `string`

Defined in: [plugins/sql-core/src/sql.ts:105](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L105)

`^` on most engines; PostgreSQL spells it `#`, because `^` there is exponentiation.

Thunks, like `moduloExpression`: SQLite has no xor and builds one from `|` and `&`, naming each
operand twice. Rendering an operand binds it, so reusing the text without rebinding would leave
placeholders with no parameters behind them.

#### Parameters

##### left

() => `string`

##### right

() => `string`

#### Returns

`string`

***

### bitwiseOperand()

> **bitwiseOperand**(`operand`): `string`

Defined in: [plugins/sql-core/src/sql.ts:112](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L112)

A numeric operand made safe for a bitwise operator.

Numbers are stored as `double precision`, and PostgreSQL has no bitwise operator for that —
`operator does not exist: double precision & unknown`. Casting is the whole difference.

#### Parameters

##### operand

`string`

#### Returns

`string`

***

### concatExpression()

> **concatExpression**(`left`, `right`): `string`

Defined in: [plugins/sql-core/src/sql.ts:114](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L114)

`||` in the standard, a function in MySQL, `+` in MSSQL.

#### Parameters

##### left

`string`

##### right

`string`

#### Returns

`string`

***

### matchesExpression()

> **matchesExpression**(`subject`, `pattern`): `string`

Defined in: [plugins/sql-core/src/sql.ts:116](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L116)

Pattern match. Only declared by a dialect whose `renders` admits `matches`.

#### Parameters

##### subject

`string`

##### pattern

`string`

#### Returns

`string`

***

### arrayContainsExpression()

> **arrayContainsExpression**(`column`, `placeholder`): `string`

Defined in: [plugins/sql-core/src/sql.ts:129](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L129)

SQL testing whether a JSON array column holds `value`.

`tags.includes("featured")` is membership, not substring matching. Rendering it as
`LIKE '%featured%'` is wrong twice over: PostgreSQL and MySQL reject it outright
against a JSON column, and SQLite — which stores JSON as text — accepts it and matches
the wrong rows, because `"feat"` is a substring of `"featured"` and a value in one
element can match against another.

Pairs with `encodeArrayContainsValue`, because the dialects disagree about whether the
parameter is the raw value or its JSON encoding.

#### Parameters

##### column

`string`

##### placeholder

`string`

#### Returns

`string`

***

### encodeArrayContainsValue()

> **encodeArrayContainsValue**(`value`): `unknown`

Defined in: [plugins/sql-core/src/sql.ts:131](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L131)

The parameter `arrayContainsExpression` expects, from the value the caller compared.

#### Parameters

##### value

`unknown`

#### Returns

`unknown`

***

### jsonPathExpression()

> **jsonPathExpression**(`rootColumn`, `path`, `leafType`): `string`

Defined in: [plugins/sql-core/src/sql.ts:147](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L147)

Reads a value out of a JSON column so a nested property can be filtered on.

A nested subtree is stored as ONE JSON column named for its root (see
`sqlColumnProperties`), so `payload.operand.value` is not a column — it is a path into
the `payload` column. Without this the translator rendered the leaf name alone and
emitted `"value" = $1`, a column that does not exist.

`leafType` is needed because every engine extracts JSON as text by default, and text
comparison answers `price > 9` with the wrong rows once a value reaches double digits.
Each dialect casts back to the type the schema declared.

#### Parameters

##### rootColumn

`string`

Already quoted, as returned by `quoteIdentifier`.

##### path

`string`[]

Storage-side segment names BELOW the root, leaf last.

##### leafType

`SchemaTypes`

#### Returns

`string`
