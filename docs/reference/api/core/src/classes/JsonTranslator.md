[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JsonTranslator

# Class: JsonTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/JsonTranslator.ts:11](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L11)

## Extends

- [`DataTranslator`](DataTranslator.md)\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new JsonTranslator**\<`TRoot`, `TShape`\>(`query`, `innerSide?`): `JsonTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/JsonTranslator.ts:20](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L20)

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

##### innerSide?

[`JoinInnerSide`](../type-aliases/JoinInnerSide.md)

The inner collection's rows, when this query carries a `join` option.
A plugin that omits it for a query that HAS a join gets a throw from `join()` rather than
a silently un-joined result.

#### Returns

`JsonTranslator`\<`TRoot`, `TShape`\>

#### Overrides

[`DataTranslator`](DataTranslator.md).[`constructor`](DataTranslator.md#constructor)

## Methods

### translate()

> **translate**(`data`): [`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:75](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/DataTranslator.ts#L75)

#### Parameters

##### data

`unknown`

#### Returns

[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>

#### Inherited from

[`DataTranslator`](DataTranslator.md).[`translate`](DataTranslator.md#translate)

***

### join()

> **join**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:33](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L33)

The hash join itself, over rows already in memory — the floor every non-SQL backend
stands on.

Both halves are deserialized here, each with its own schema, because that is where the
`===` on key values is specified to happen: in entity shape, by the property names the
caller wrote in the key selectors. A `from`-renamed column reads correctly for free.

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"join"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`join`](DataTranslator.md#join)

***

### filter()

> **filter**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:56](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L56)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`filter`](DataTranslator.md#filter)

***

### map()

> **map**\<`T`\>(`data`, `option`): `T`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:75](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L75)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `"map"`\>

#### Returns

`T`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`map`](DataTranslator.md#map)

***

### group()

> **group**\<`T`\>(`data`, `option`): `T`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:105](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L105)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `"group"`\>

#### Returns

`T`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`group`](DataTranslator.md#group)

***

### count()

> **count**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:149](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L149)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"count"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`count`](DataTranslator.md#count)

***

### min()

> **min**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:162](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L162)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`min`](DataTranslator.md#min)

***

### max()

> **max**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:180](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L180)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`max`](DataTranslator.md#max)

***

### sort()

> **sort**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:198](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L198)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sort"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sort`](DataTranslator.md#sort)

***

### nearest()

> **nearest**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:236](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L236)

The similarity search itself, over values already in memory.

This is the floor the whole feature stands on: it is reached whenever the backend did
not do the search, which is every backend except the ones with a native vector index.
It reads the property through the option's selector, so it works on any shape the rows
arrive in.

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"nearest"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`nearest`](DataTranslator.md#nearest)

***

### sum()

> **sum**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:247](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L247)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sum`](DataTranslator.md#sum)

***

### distinct()

> **distinct**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:273](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L273)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`distinct`](DataTranslator.md#distinct)

***

### skip()

> **skip**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:305](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L305)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"skip"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`skip`](DataTranslator.md#skip)

***

### take()

> **take**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:325](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts#L325)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"take"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`take`](DataTranslator.md#take)
