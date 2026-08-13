[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedQueryOption

# Type Alias: SerializedQueryOption

> **SerializedQueryOption** = \{ `name`: `"skip"`; `value`: `number`; \} \| \{ `name`: `"take"`; `value`: `number`; \} \| \{ `name`: `"sort"`; `value`: \{ `propertyName`: `string`; `direction`: [`QueryOrdering`](../enumerations/QueryOrdering.md); \}; \} \| \{ `name`: `"filter"`; `value`: \{ `expression`: [`SerializedExpression`](SerializedExpression.md); \}; \} \| \{ `name`: `"nearest"`; `value`: \{ `propertyName`: `string`; `vector`: `number`[]; `count`: `number`; \}; \} \| \{ `name`: `"join"`; `value`: \{ `kind`: [`JoinKind`](JoinKind.md); `innerCollectionName`: `string`; `outerKeyPath`: `string`; `innerKeyPath`: `string`; `innerOptions`: `SerializedQueryOption`[]; `semiJoinKeyThreshold`: `number`; \}; \} \| \{ `name`: `"count"` \| `"min"` \| `"max"` \| `"sum"` \| `"distinct"`; `value`: `true`; \}

Defined in: [core/src/plugins/wire/types.ts:27](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L27)

A query option, in the form that survives a wire.

## Type Declaration

\{ `name`: `"skip"`; `value`: `number`; \}

### name

> **name**: `"skip"`

### value

> **value**: `number`

\{ `name`: `"take"`; `value`: `number`; \}

### name

> **name**: `"take"`

### value

> **value**: `number`

\{ `name`: `"sort"`; `value`: \{ `propertyName`: `string`; `direction`: [`QueryOrdering`](../enumerations/QueryOrdering.md); \}; \}

### name

> **name**: `"sort"`

### value

> **value**: `object`

#### value.propertyName

> **propertyName**: `string`

#### value.direction

> **direction**: [`QueryOrdering`](../enumerations/QueryOrdering.md)

The selector is dropped and rebuilt from the property on arrival.

\{ `name`: `"filter"`; `value`: \{ `expression`: [`SerializedExpression`](SerializedExpression.md); \}; \}

### name

> **name**: `"filter"`

### value

> **value**: `object`

#### value.expression

> **expression**: [`SerializedExpression`](SerializedExpression.md)

The expression only — no closure and no params bag.

A filter reaching a query option is already BOUND: `ParamReferenceExpression` never escapes
the parser, so every param value is already a literal in the tree. The receiver rebuilds a
runnable predicate from the tree with `toStrictPredicate`.

\{ `name`: `"nearest"`; `value`: \{ `propertyName`: `string`; `vector`: `number`[]; `count`: `number`; \}; \}

### name

> **name**: `"nearest"`

### value

> **value**: `object`

#### value.propertyName

> **propertyName**: `string`

#### value.vector

> **vector**: `number`[]

#### value.count

> **count**: `number`

\{ `name`: `"join"`; `value`: \{ `kind`: [`JoinKind`](JoinKind.md); `innerCollectionName`: `string`; `outerKeyPath`: `string`; `innerKeyPath`: `string`; `innerOptions`: `SerializedQueryOption`[]; `semiJoinKeyThreshold`: `number`; \}; \}

### name

> **name**: `"join"`

### value

> **value**: `object`

#### value.kind

> **kind**: [`JoinKind`](JoinKind.md)

#### value.innerCollectionName

> **innerCollectionName**: `string`

Named, not described — the receiver resolves its own schema for it.

#### value.outerKeyPath

> **outerKeyPath**: `string`

#### value.innerKeyPath

> **innerKeyPath**: `string`

#### value.innerOptions

> **innerOptions**: `SerializedQueryOption`[]

#### value.semiJoinKeyThreshold

> **semiJoinKeyThreshold**: `number`

\{ `name`: `"count"` \| `"min"` \| `"max"` \| `"sum"` \| `"distinct"`; `value`: `true`; \}

### name

> **name**: `"count"` \| `"min"` \| `"max"` \| `"sum"` \| `"distinct"`

### value

> **value**: `true`
