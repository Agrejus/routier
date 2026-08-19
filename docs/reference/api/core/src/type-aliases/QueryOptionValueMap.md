[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryOptionValueMap

# Type Alias: QueryOptionValueMap\<T\>

> **QueryOptionValueMap**\<`T`\> = `object`

Defined in: [core/src/plugins/query/types.ts:51](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L51)

## Type Parameters

### T

`T` *extends* `object`

## Properties

### skip

> **skip**: `number`

Defined in: [core/src/plugins/query/types.ts:52](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L52)

***

### take

> **take**: `number`

Defined in: [core/src/plugins/query/types.ts:53](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L53)

***

### sort

> **sort**: `object`

Defined in: [core/src/plugins/query/types.ts:54](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L54)

#### selector

> **selector**: [`GenericFunction`](GenericFunction.md)\<`T`, `T`\[keyof `T`\]\>

#### direction

> **direction**: [`QueryOrdering`](../enumerations/QueryOrdering.md)

#### propertyName

> **propertyName**: `string`

#### property?

> `optional` **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`T`\> \| `null`

***

### map

> **map**: `object`

Defined in: [core/src/plugins/query/types.ts:55](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L55)

#### selector

> **selector**: [`GenericFunction`](GenericFunction.md)\<`T`, `any`\>

#### fields

> **fields**: [`QueryField`](QueryField.md)[]

***

### group

> **group**: `object`

Defined in: [core/src/plugins/query/types.ts:56](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L56)

#### selector

> **selector**: [`GenericFunction`](GenericFunction.md)\<`T`, `any`\>

#### key

> **key**: [`QueryField`](QueryField.md)

#### fields

> **fields**: [`QueryField`](QueryField.md)[]

***

### filter

> **filter**: `object`

Defined in: [core/src/plugins/query/types.ts:57](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L57)

#### params?

> `optional` **params**: `object`

#### filter

> **filter**: [`ParamsFilter`](ParamsFilter.md)\<`T`, \{ \}\> \| [`Filter`](Filter.md)\<`T`\>

#### expression

> **expression**: [`Expression`](../classes/Expression.md)

***

### nearest

> **nearest**: `object`

Defined in: [core/src/plugins/query/types.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L65)

Similarity search: an ordering plus a limit, never a filter.

`count` is part of the option rather than a separate `take` because the two are one
operation to a backend that can push this down — `ORDER BY ... LIMIT n` is what makes an
approximate index usable, and splitting them would order every row before limiting.

#### selector

> **selector**: [`GenericFunction`](GenericFunction.md)\<`T`, `T`\[keyof `T`\]\>

#### propertyName

> **propertyName**: `string`

#### property?

> `optional` **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`T`\> \| `null`

#### vector

> **vector**: `number`[]

#### count

> **count**: `number`

***

### join

> **join**: `object`

Defined in: [core/src/plugins/query/types.ts:78](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L78)

An equi-join against a second collection, interpreted by whoever receives it.

A first-class query option rather than a datastore side-path: a SQL backend emits a real
`INNER JOIN`/`LEFT JOIN`, every other backend loads the rows it needs and the shared hash
join runs inside the plugin, and a cross-plugin join runs in the datastore's memory half.
All three produce the same pairs — see `specs/joins.md`.

Serializable by construction: property paths and a schema id, never live rows, with any
filter's values travelling in its params object. That is what lets the whole option be
forwarded to a server once expression-tree serialization lands.

#### kind

> **kind**: [`JoinKind`](JoinKind.md)

#### innerSchemaId

> **innerSchemaId**: [`SchemaId`](SchemaId.md)

Resolved through `event.schemas`, which already carries every schema in the store.

#### outerKey

> **outerKey**: [`JoinKeyReference`](JoinKeyReference.md)

#### innerKey

> **innerKey**: [`JoinKeyReference`](JoinKeyReference.md)

#### innerOptions

> **innerOptions**: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

The inner side's own filters — INCLUDING its soft-delete scope and `.scope()`
filters. Every interpreter must apply these: it is the only place they exist, because
a join bypasses the inner collection's normal read path.

#### crossPlugin

> **crossPlugin**: `boolean`

Whether the two sides live on DIFFERENT plugin instances, in which case no plugin can
receive the option and the datastore is the interpreter.

Decided by plugin instance identity at build time, never by comparing database names —
two plugins over one database are still two interpreters, and one name can front two
databases.

#### semiJoinKeyThreshold

> **semiJoinKeyThreshold**: `number`

How many distinct outer keys are still worth turning into an `IN (...)` prefilter on the
inner read — the datastore's `semiJoinKeyThreshold`, default 500.

Carried in the option because the decision is made where the join executes, which is
usually inside a plugin, and a plugin cannot see a datastore's configuration. A number
serializes; a reference to the store would not.

Cost only. Above the threshold the inner side is read under its own scopes and the hash
join discards the surplus — the same answer by a slower route.

***

### min

> **min**: `true`

Defined in: [core/src/plugins/query/types.ts:112](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L112)

***

### max

> **max**: `true`

Defined in: [core/src/plugins/query/types.ts:113](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L113)

***

### count

> **count**: `true`

Defined in: [core/src/plugins/query/types.ts:114](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L114)

***

### sum

> **sum**: `true`

Defined in: [core/src/plugins/query/types.ts:115](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L115)

***

### distinct

> **distinct**: `true`

Defined in: [core/src/plugins/query/types.ts:116](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L116)
