[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TupleTranslator

# Class: TupleTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/TupleTranslator.ts:26](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L26)

The memory half's pass over JOIN TUPLES.

`JsonTranslator` cannot do this job, and the reason is one line of it: `map` and `group` walk
`option.value.fields` and deserialize each field through its `PropertyInfo`. A tuple has no
schema and no fields — `getFields` over `([p, m]) => ({ ... })` extracts nothing meaningful —
so that loop would either no-op or write properties onto a two-element array.

Everything a join query is allowed to do after the join is expressible as a plain closure
over the tuple, and that is all this does. The lambdas the caller wrote (`([p, m]) => ...`)
are applied as-is, which is also why the result is identical whichever backend produced the
pairs.

Both halves are already in entity shape when the tuples arrive here (the wire contract), so
there is nothing left to deserialize — the reason the missing field loop costs nothing.

The absent operations are absent by design, not by omission: `sum`/`min`/`max`/`distinct` and
`group` are not declared on the tuple queryable's type, so reaching them means something
built an option this API cannot express, and a throw naming it is the honest answer.

## Extends

- [`DataTranslator`](DataTranslator.md)\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new TupleTranslator**\<`TRoot`, `TShape`\>(`query`): `TupleTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:27](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/DataTranslator.ts#L27)

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

#### Returns

`TupleTranslator`\<`TRoot`, `TShape`\>

#### Inherited from

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

### filter()

> **filter**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:28](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L28)

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

> **map**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L44)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"map"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`map`](DataTranslator.md#map)

***

### sort()

> **sort**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:51](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L51)

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

### skip()

> **skip**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:84](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L84)

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

Defined in: [core/src/plugins/translators/TupleTranslator.ts:93](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L93)

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

***

### count()

> **count**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:102](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L102)

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

### join()

> **join**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:115](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L115)

Already joined by the time anything reaches here.

The pairs were produced either by the plugin (its translator's `join`) or by the datastore
before this pass ran, so the option is a record of what happened rather than work to do.

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"join"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`join`](DataTranslator.md#join)

***

### group()

> **group**\<`TResult`\>(`_`, `__`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:119](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L119)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### \_

`unknown`

##### \_\_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"group"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`group`](DataTranslator.md#group)

***

### sum()

> **sum**\<`TResult`\>(`_`, `__`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:123](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L123)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### \_

`unknown`

##### \_\_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sum`](DataTranslator.md#sum)

***

### min()

> **min**\<`TResult`\>(`_`, `__`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:127](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L127)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### \_

`unknown`

##### \_\_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`min`](DataTranslator.md#min)

***

### max()

> **max**\<`TResult`\>(`_`, `__`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:131](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L131)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### \_

`unknown`

##### \_\_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`max`](DataTranslator.md#max)

***

### distinct()

> **distinct**\<`TResult`\>(`_`, `__`): `TResult`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:135](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L135)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### \_

`unknown`

##### \_\_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`distinct`](DataTranslator.md#distinct)

***

### nearest()

> **nearest**(`_`, `__`): `TShape`

Defined in: [core/src/plugins/translators/TupleTranslator.ts:139](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/TupleTranslator.ts#L139)

Abstract on purpose, unlike the pass-throughs a storage translator can usually inherit.

Every other shaper degrades safely when a backend ignores it — an unsorted result is
still the right rows. A similarity search is not: it is the only option whose value is
ENTIRELY in the ordering and the limit, so a translator that quietly passes the data
through returns every row in insertion order and calls it the ten nearest.

Requiring an answer here means a new translator cannot be written without deciding
whether its backend performed the search, and the compiler asks the question.

#### Parameters

##### \_

`unknown`

##### \_\_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"nearest"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`nearest`](DataTranslator.md#nearest)
