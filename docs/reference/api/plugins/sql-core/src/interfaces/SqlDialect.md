[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / SqlDialect

# Interface: SqlDialect

Defined in: [plugins/sql-core/src/sql.ts:23](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L23)

Dialect interface for generating portable SQL WHERE fragments.

## Properties

### stringMatchKind

> **stringMatchKind**: `"LIKE"` \| `"GLOB"`

Defined in: [plugins/sql-core/src/sql.ts:26](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L26)

***

### jsonColumnType

> **jsonColumnType**: `string`

Defined in: [plugins/sql-core/src/sql.ts:35](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L35)

Column type for a nested object or array held in a single column.

Nested structures have no native column type in any SQL engine, so each one gets
stored as JSON in whatever form that engine offers. Core never sees this — it hands
plugins a partial entity and the plugin decides how a nested value becomes a column.

## Methods

### quoteIdentifier()

> **quoteIdentifier**(`name`): `string`

Defined in: [plugins/sql-core/src/sql.ts:24](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L24)

#### Parameters

##### name

`string`

#### Returns

`string`

***

### getPlaceholder()

> **getPlaceholder**(`paramIndex`): `string`

Defined in: [plugins/sql-core/src/sql.ts:25](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L25)

#### Parameters

##### paramIndex

`number`

#### Returns

`string`

***

### likeEscapeClause()

> **likeEscapeClause**(): `string`

Defined in: [plugins/sql-core/src/sql.ts:27](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L27)

#### Returns

`string`

***

### encodeJson()

> **encodeJson**(`value`): `unknown`

Defined in: [plugins/sql-core/src/sql.ts:44](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L44)

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

Defined in: [plugins/sql-core/src/sql.ts:52](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L52)

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

Defined in: [plugins/sql-core/src/sql.ts:62](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L62)

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

Defined in: [plugins/sql-core/src/sql.ts:67](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L67)

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

### jsonPathExpression()

> **jsonPathExpression**(`rootColumn`, `path`, `leafType`): `string`

Defined in: [plugins/sql-core/src/sql.ts:83](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L83)

Reads a value out of a JSON column so a nested property can be filtered on.

A nested subtree is stored as ONE JSON column named for its root (see
`sqlColumnProperties`), so `payload.inner.value` is not a column — it is a path into
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
